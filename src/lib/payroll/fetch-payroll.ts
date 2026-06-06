import type { SupabaseClient } from "@supabase/supabase-js";
import { collectPayrollTargetEmployeeIds } from "@/lib/payroll/collect-targets";
import type { PayrollScope } from "@/lib/payroll/resolve-scope";
import { recalculateEmployeeMonthlyPayroll } from "@/lib/payroll/recalculate-employee";
import type { PayrollWithEmployee } from "@/types/database";

export async function fetchPayrollForPeriod(
  readSupabase: SupabaseClient,
  writeSupabase: SupabaseClient,
  year: number,
  month: number,
  scope: PayrollScope
): Promise<PayrollWithEmployee[]> {
  const targetIds = await collectPayrollTargetEmployeeIds(
    readSupabase,
    year,
    month,
    scope,
    "rls"
  );

  if (targetIds.length === 0) {
    return [];
  }

  const { data, error } = await writeSupabase
    .from("monthly_payroll")
    .select("*, employees(id, name, employee_code, hourly_rate, store_id, stores(id, name))")
    .eq("year", year)
    .eq("month", month)
    .in("employee_id", targetIds)
    .order("total_pay", { ascending: false });

  if (error) throw error;

  const rows = (data as unknown as PayrollWithEmployee[]) ?? [];
  const existingIds = new Set(rows.map((row) => row.employee_id));
  const missingIds = targetIds.filter((id) => !existingIds.has(id));

  for (const employeeId of missingIds) {
    const result = await recalculateEmployeeMonthlyPayroll(writeSupabase, employeeId, year, month);
    if (!result.ok) {
      console.error("[payroll/fetch] recalculate failed", { employeeId, error: result.error });
    }
  }

  if (missingIds.length === 0) {
    return rows;
  }

  const { data: refreshed, error: refreshError } = await writeSupabase
    .from("monthly_payroll")
    .select("*, employees(id, name, employee_code, hourly_rate, store_id, stores(id, name))")
    .eq("year", year)
    .eq("month", month)
    .in("employee_id", targetIds)
    .order("total_pay", { ascending: false });

  if (refreshError) throw refreshError;
  return (refreshed as unknown as PayrollWithEmployee[]) ?? rows;
}
