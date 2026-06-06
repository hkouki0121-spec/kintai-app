import type { SupabaseClient } from "@supabase/supabase-js";
import { collectPayrollTargetEmployeeIds } from "@/lib/payroll/collect-targets";
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
  return (data as unknown as PayrollWithEmployee[]) ?? [];
}
