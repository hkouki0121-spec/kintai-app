import { createClient } from "@/lib/supabase/server";
import { PayrollManager } from "@/components/admin/PayrollManager";
import { fetchActiveStores, isAllStores } from "@/lib/stores/queries";
import { ALL_STORES_VALUE } from "@/lib/stores/constants";
import type { PayrollWithEmployee } from "@/types/database";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; store?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;
  const storeId = params.store ?? ALL_STORES_VALUE;

  const supabase = await createClient();
  const stores = await fetchActiveStores(supabase);

  let query = supabase
    .from("monthly_payroll")
    .select("*, employees(id, name, employee_code, store_id, stores(id, name))")
    .eq("year", year)
    .eq("month", month)
    .order("total_pay", { ascending: false });

  if (!isAllStores(storeId)) {
    query = supabase
      .from("monthly_payroll")
      .select("*, employees!inner(id, name, employee_code, store_id, stores(id, name))")
      .eq("year", year)
      .eq("month", month)
      .eq("employees.store_id", storeId)
      .order("total_pay", { ascending: false });
  }

  const { data } = await query;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">給与計算</h2>
        <p className="text-sm text-slate-600">
          店舗を選択して給与を計算・確認できます。15分未満の勤務は除外、30分単位切り捨て。
        </p>
      </div>
      <PayrollManager
        stores={stores}
        initialStoreId={storeId}
        initialPayroll={(data as PayrollWithEmployee[]) ?? []}
        initialYear={year}
        initialMonth={month}
      />
    </div>
  );
}
