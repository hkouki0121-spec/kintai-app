import type { SupabaseClient } from "@supabase/supabase-js";
import { getJstMonthBounds } from "@/lib/payroll/jst-month";
import { isAllStores } from "@/lib/stores/queries";

/** 給与再計算・表示の対象従業員ID（勤怠ベース + 店舗所属の在籍者） */
export async function collectPayrollTargetEmployeeIds(
  supabase: SupabaseClient,
  year: number,
  month: number,
  storeId?: string | null,
  companyId?: string | null
): Promise<string[]> {
  const { start: monthStart, end: monthEnd } = getJstMonthBounds(year, month);
  const ids = new Set<string>();

  let attendanceQuery = supabase
    .from("attendance_records")
    .select("employee_id")
    .lt("clock_in", monthEnd.toISOString())
    .or(`clock_out.gt.${monthStart.toISOString()},clock_out.is.null`);

  if (companyId) {
    attendanceQuery = attendanceQuery.eq("company_id", companyId);
  }
  if (!isAllStores(storeId)) {
    attendanceQuery = attendanceQuery.eq("store_id", storeId!);
  }

  const { data: attendanceRows, error: attendanceError } = await attendanceQuery;
  if (attendanceError) throw attendanceError;
  for (const row of attendanceRows ?? []) {
    ids.add(row.employee_id);
  }

  let employeeQuery = supabase.from("employees").select("id").eq("is_active", true);
  if (companyId) {
    employeeQuery = employeeQuery.eq("company_id", companyId);
  }
  if (!isAllStores(storeId)) {
    employeeQuery = employeeQuery.eq("store_id", storeId!);
  }

  const { data: employeeRows, error: employeeError } = await employeeQuery;
  if (employeeError) throw employeeError;
  for (const row of employeeRows ?? []) {
    ids.add(row.id);
  }

  return [...ids];
}
