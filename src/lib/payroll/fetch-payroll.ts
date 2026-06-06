import type { SupabaseClient } from "@supabase/supabase-js";
import { collectPayrollTargetEmployeeIds } from "@/lib/payroll/collect-targets";
import { recalculateEmployeeMonthlyPayroll } from "@/lib/payroll/recalculate-employee";
import type { PayrollWithEmployee } from "@/types/database";

export async function fetchPayrollForPeriod(
  supabase: SupabaseClient,
  year: number,
  month: number,
  storeId?: string | null,
  companyId?: string | null
): Promise<PayrollWithEmployee[]> {
  const targetIds = await collectPayrollTargetEmployeeIds(
    supabase,
    year,
    month,
    storeId,
    companyId
  );

  if (targetIds.length === 0) {
    return [];
  }

  let query = supabase
    .from("monthly_payroll")
    .select("*, employees(id, name, employee_code, hourly_rate, store_id, stores(id, name))")
    .eq("year", year)
    .eq("month", month)
    .in("employee_id", targetIds)
    .order("total_pay", { ascending: false });

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data as unknown as PayrollWithEmployee[]) ?? [];
  const existingIds = new Set(rows.map((row) => row.employee_id));
  const missingIds = targetIds.filter((id) => !existingIds.has(id));

  for (const employeeId of missingIds) {
    const result = await recalculateEmployeeMonthlyPayroll(supabase, employeeId, year, month);
    if (!result.ok) {
      console.error("[payroll/fetch] recalculate failed", { employeeId, error: result.error });
    }
  }

  if (missingIds.length === 0) {
    return rows;
  }

  const { data: refreshed, error: refreshError } = await query;
  if (refreshError) throw refreshError;
  return (refreshed as unknown as PayrollWithEmployee[]) ?? rows;
}
