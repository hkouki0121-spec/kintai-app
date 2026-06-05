import type { SupabaseClient } from "@supabase/supabase-js";
import { syncPayrollFromAttendance } from "@/lib/payroll/sync-from-attendance";

export async function runMonthlyPayroll(
  supabase: SupabaseClient,
  year: number,
  month: number,
  storeId?: string | null,
  companyId?: string | null
): Promise<{ processed: number; errors: string[] }> {
  return syncPayrollFromAttendance(supabase, year, month, storeId, companyId);
}
