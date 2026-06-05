import { NextResponse } from "next/server";
import { getCompanyContext } from "@/lib/auth/company-context";
import { BACKUP_BUCKET } from "@/lib/backup/constants";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

function canAccessBackupPath(
  context: NonNullable<Awaited<ReturnType<typeof getCompanyContext>>>,
  storagePath: string
): boolean {
  const companyIdFromPath = storagePath.split("/")[0];
  if (!companyIdFromPath) return false;
  if (context.isSuperAdmin) return true;
  return context.companyId === companyIdFromPath;
}

/** バックアップ CSV ダウンロード */
export async function GET(request: Request) {
  const supabase = await createClient();
  const context = await getCompanyContext(supabase);

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "path が必要です" }, { status: 400 });
  }

  if (!canAccessBackupPath(context, path)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceClient();
  const { data, error } = await service.storage.from(BACKUP_BUCKET).download(path);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "ファイルが見つかりません" },
      { status: 404 }
    );
  }

  const fileName = path.split("/").pop() ?? "backup.csv";
  const buffer = Buffer.from(await data.arrayBuffer());

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    },
  });
}
