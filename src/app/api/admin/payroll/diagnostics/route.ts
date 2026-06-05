import { NextResponse } from "next/server";
import { getCompanyContext } from "@/lib/auth/company-context";
import { getPayrollDiagnostics } from "@/lib/payroll/diagnostics";
import { createClient } from "@/lib/supabase/server";
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

  const diagnostics = await getPayrollDiagnostics(
    supabase,
    year,
    month,
    isAllStores(storeId) ? null : storeId,
    context.isSuperAdmin ? null : context.companyId
  );

  return NextResponse.json(diagnostics);
}
