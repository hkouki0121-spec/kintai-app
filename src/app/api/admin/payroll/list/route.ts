import { NextResponse } from "next/server";
import { getCompanyContext } from "@/lib/auth/company-context";
import { fetchPayrollForPeriod } from "@/lib/payroll/fetch-payroll";
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

  try {
    const payroll = await fetchPayrollForPeriod(
      supabase,
      year,
      month,
      isAllStores(storeId) ? null : storeId,
      context.isSuperAdmin ? null : context.companyId
    );
    return NextResponse.json({ payroll });
  } catch (error) {
    const message = error instanceof Error ? error.message : "給与一覧の取得に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
