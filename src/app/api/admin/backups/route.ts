import { NextResponse } from "next/server";
import { getCompanyContext } from "@/lib/auth/company-context";
import { getBackupDateInJst } from "@/lib/backup/backup-date";
import { runCompanyBackup } from "@/lib/backup/run-company-backup";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

function resolveCompanyId(
  context: NonNullable<Awaited<ReturnType<typeof getCompanyContext>>>,
  requestedCompanyId?: string | null
): string | NextResponse {
  if (context.isSuperAdmin) {
    if (!requestedCompanyId) {
      return NextResponse.json({ error: "companyId が必要です" }, { status: 400 });
    }
    return requestedCompanyId;
  }

  if (!context.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (requestedCompanyId && requestedCompanyId !== context.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return context.companyId;
}

/** バックアップ一覧取得 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const context = await getCompanyContext(supabase);

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedCompanyId = searchParams.get("companyId");

  const companyId = resolveCompanyId(context, requestedCompanyId);
  if (companyId instanceof NextResponse) return companyId;

  let query = supabase
    .from("backup_runs")
    .select("id, company_id, backup_date, status, files, error_message, created_at")
    .order("backup_date", { ascending: false })
    .limit(60);

  if (!context.isSuperAdmin) {
    query = query.eq("company_id", companyId);
  } else if (requestedCompanyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ backups: data ?? [] });
}

/** 手動バックアップ作成 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const context = await getCompanyContext(supabase);

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { companyId?: string; backupDate?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const companyId = resolveCompanyId(context, body.companyId ?? null);
  if (companyId instanceof NextResponse) return companyId;

  const backupDate = body.backupDate ?? getBackupDateInJst();
  const service = createServiceClient();
  const result = await runCompanyBackup(service, companyId, backupDate);

  if (result.status === "failed") {
    return NextResponse.json(
      {
        ok: false,
        error: result.errorMessage ?? "バックアップに失敗しました",
        result,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, result });
}
