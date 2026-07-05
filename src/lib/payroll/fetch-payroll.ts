import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchPayrollListForScope } from "@/lib/payroll/fetch-payroll-list";
import type { PayrollScope } from "@/lib/payroll/resolve-scope";
import type { PayrollWithEmployee } from "@/types/database";

/** 給与一覧の読み取り（再計算なし） */
export async function fetchPayrollForPeriod(
  _readSupabase: SupabaseClient,
  writeSupabase: SupabaseClient,
  year: number,
  month: number,
  scope: PayrollScope
): Promise<PayrollWithEmployee[]> {
  return fetchPayrollListForScope(writeSupabase, year, month, scope);
}
