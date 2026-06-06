import { NextResponse } from "next/server";
import { getCompanyContext } from "@/lib/auth/company-context";
import { getPayrollDiagnostics } from "@/lib/payroll/diagnostics";
import { resolvePayrollScope } from "@/lib/payroll/resolve-scope";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ALL_STORES_VALUE } from "@/lib/stores/constants";
import { isAllStores } from "@/lib/stores/queries";

export async function GET(request: Request) {
  const supabase = await createClient();
  const context = await getCompanyContext(supabase);

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  const storeId = searchParams.get("storeId") ?? ALL_STORES_VALUE;

  if (!year || !month) {
    return NextResponse.json({ error: "year と month が必要です" }, { status: 400 });
  }

  try {
    const scope = await resolvePayrollScope(
      supabase,
      context,
      isAllStores(storeId) ? null : storeId
    );
    const serviceSupabase = createServiceClient();
    const diagnostics = await getPayrollDiagnostics(
      supabase,
      serviceSupabase,
      year,
      month,
      scope
    );
    return NextResponse.json(diagnostics);
  } catch (error) {
    const message = error instanceof Error ? error.message : "診断の取得に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
