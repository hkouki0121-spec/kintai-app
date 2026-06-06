import { NextResponse } from "next/server";
import { getCompanyContext } from "@/lib/auth/company-context";
import { fetchPayrollForPeriod } from "@/lib/payroll/fetch-payroll";
import { syncPayrollFromAttendance } from "@/lib/payroll/sync-from-attendance";
import { createClient } from "@/lib/supabase/server";
import { ALL_STORES_VALUE } from "@/lib/stores/constants";
import { isAllStores } from "@/lib/stores/queries";

type CalculateBody = {
  year?: number;
  month?: number;
  storeId?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const context = await getCompanyContext(supabase);

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CalculateBody;
  try {
    body = (await request.json()) as CalculateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const year = Number(body.year);
  const month = Number(body.month);
  const storeId = body.storeId ?? ALL_STORES_VALUE;

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: "year と month が必要です" }, { status: 400 });
  }

  let storeLabel = "全店舗";
  if (!isAllStores(storeId)) {
    const { data: store } = await supabase
      .from("stores")
      .select("name")
      .eq("id", storeId)
      .maybeSingle();
    storeLabel = store?.name ?? storeId;
  }

  const companyId = context.isSuperAdmin ? null : context.companyId;

  try {
    const result = await syncPayrollFromAttendance(
      supabase,
      year,
      month,
      isAllStores(storeId) ? null : storeId,
      companyId,
      storeLabel
    );
    const payroll = await fetchPayrollForPeriod(
      supabase,
      year,
      month,
      isAllStores(storeId) ? null : storeId,
      companyId
    );

    return NextResponse.json({
      ...result,
      payroll,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "給与計算に失敗しました";
    console.error("[payroll/calculate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
