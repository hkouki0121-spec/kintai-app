import type { SupabaseClient } from "@supabase/supabase-js";
import type { PayrollScope } from "@/lib/payroll/resolve-scope";
import { isAllStores } from "@/lib/stores/queries";
import type { PayrollWithEmployee } from "@/types/database";

const PAYROLL_LIST_SELECT =
  "id, employee_id, year, month, company_id, regular_hours, night_hours, regular_pay, night_pay, total_pay, attendance_days, actual_regular_hours, actual_night_hours, actual_total_hours, overtime_hours, calculated_at, employees(id, name, employee_code, hourly_rate, store_id, stores(id, name))";

/** monthly_payroll を直接取得（勤怠スキャン・自動再計算なし・表示専用） */
export async function fetchPayrollListForScope(
  supabase: SupabaseClient,
  year: number,
  month: number,
  scope: PayrollScope
): Promise<PayrollWithEmployee[]> {
  let query = supabase
    .from("monthly_payroll")
    .select(PAYROLL_LIST_SELECT)
    .eq("year", year)
    .eq("month", month)
    .order("total_pay", { ascending: false });

  if (scope.dataCompanyIds.length > 0) {
    query = query.in("company_id", scope.dataCompanyIds);
  } else if (scope.adminCompanyId) {
    query = query.eq("company_id", scope.adminCompanyId);
  }

  const { data, error } = await query;
  if (error) throw error;

  let rows = (data as unknown as PayrollWithEmployee[]) ?? [];

  if (!isAllStores(scope.storeId)) {
    rows = rows.filter((row) => row.employees?.store_id === scope.storeId);
  } else if (scope.accessibleStoreIds.length > 0) {
    const storeSet = new Set(scope.accessibleStoreIds);
    rows = rows.filter(
      (row) => row.employees?.store_id && storeSet.has(row.employees.store_id)
    );
  }

  return rows;
}
