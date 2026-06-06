import type { SupabaseClient } from "@supabase/supabase-js";
import { getJstMonthBounds } from "@/lib/payroll/jst-month";
import { isAllStores } from "@/lib/stores/queries";

export type AttendanceRecordRow = {
  id: string;
  employee_id: string;
  store_id: string;
  company_id: string;
  clock_in: string;
  clock_out: string | null;
};

/** 対象月・店舗・会社で attendance_records を取得（月跨ぎ勤怠を含む） */
export async function fetchAttendanceRecordsInScope(
  supabase: SupabaseClient,
  year: number,
  month: number,
  storeId?: string | null,
  companyId?: string | null
): Promise<AttendanceRecordRow[]> {
  const { start: monthStart, end: monthEnd } = getJstMonthBounds(year, month);

  let query = supabase
    .from("attendance_records")
    .select("id, employee_id, store_id, company_id, clock_in, clock_out")
    .lt("clock_in", monthEnd.toISOString())
    .or(`clock_out.gt.${monthStart.toISOString()},clock_out.is.null`);

  if (companyId) {
    query = query.eq("company_id", companyId);
  }
  if (!isAllStores(storeId)) {
    query = query.eq("store_id", storeId!);
  }

  const { data, error } = await query.order("clock_in", { ascending: true });
  if (error) throw error;
  return (data as AttendanceRecordRow[]) ?? [];
}

/** 1従業員の対象月勤怠（全店舗・月跨ぎを含む） */
export async function fetchEmployeeAttendanceInMonth(
  supabase: SupabaseClient,
  employeeId: string,
  year: number,
  month: number
): Promise<AttendanceRecordRow[]> {
  const { start: monthStart, end: monthEnd } = getJstMonthBounds(year, month);
  const { data, error } = await supabase
    .from("attendance_records")
    .select("id, employee_id, store_id, company_id, clock_in, clock_out")
    .eq("employee_id", employeeId)
    .lt("clock_in", monthEnd.toISOString())
    .or(`clock_out.gt.${monthStart.toISOString()},clock_out.is.null`)
    .order("clock_in", { ascending: true });
  if (error) throw error;
  return (data as AttendanceRecordRow[]) ?? [];
}
