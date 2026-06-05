import type { SupabaseClient } from "@supabase/supabase-js";
import { recalculateEmployeeMonthlyPayroll } from "@/lib/payroll/recalculate-employee";
import { isAllStores } from "@/lib/stores/queries";

/** 表示中の月について、全従業員の給与を勤怠から再計算 */
export async function syncPayrollFromAttendance(
  supabase: SupabaseClient,
  year: number,
  month: number,
  storeId?: string | null,
  companyId?: string | null
): Promise<{ processed: number; errors: string[] }> {
  let employeeQuery = supabase.from("employees").select("id").eq("is_active", true);

  if (!isAllStores(storeId)) {
    employeeQuery = employeeQuery.eq("store_id", storeId!);
  }
  if (companyId) {
    employeeQuery = employeeQuery.eq("company_id", companyId);
  }

  const { data: employees, error: empError } = await employeeQuery;
  if (empError) throw empError;

  const errors: string[] = [];
  let processed = 0;

  for (const emp of employees ?? []) {
    const result = await recalculateEmployeeMonthlyPayroll(supabase, emp.id, year, month);
    if (!result.ok) {
      errors.push(`${emp.id}: ${result.error}`);
    } else {
      processed += 1;
    }
  }

  return { processed, errors };
}
