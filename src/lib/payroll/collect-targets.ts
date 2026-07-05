import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAttendanceRecordsInScope, type AttendanceRecordRow } from "@/lib/payroll/attendance-query";
import type { PayrollScope } from "@/lib/payroll/resolve-scope";
import { isAllStores } from "@/lib/stores/queries";

type CollectOptions = {
  attendanceRecords?: AttendanceRecordRow[];
};

/** 給与再計算・表示の対象従業員ID（勤怠ベース + 店舗所属の在籍者） */
export async function collectPayrollTargetEmployeeIds(
  readSupabase: SupabaseClient,
  year: number,
  month: number,
  scope: PayrollScope,
  readMode: "rls" | "service" = "rls",
  options?: CollectOptions
): Promise<string[]> {
  const ids = new Set<string>();

  const records =
    options?.attendanceRecords ??
    (
      await fetchAttendanceRecordsInScope(readSupabase, year, month, scope, readMode)
    ).records;

  for (const row of records) {
    ids.add(row.employee_id);
  }

  let employeeQuery = readSupabase.from("employees").select("id").eq("is_active", true);

  if (!isAllStores(scope.storeId)) {
    employeeQuery = employeeQuery.eq("store_id", scope.storeId!);
  } else if (readMode === "service" && scope.accessibleStoreIds.length > 0) {
    employeeQuery = employeeQuery.in("store_id", scope.accessibleStoreIds);
  } else if (readMode === "service" && scope.dataCompanyIds.length > 0) {
    employeeQuery = employeeQuery.in("company_id", scope.dataCompanyIds);
  }

  const { data: employeeRows, error: employeeError } = await employeeQuery;
  if (employeeError) throw employeeError;
  for (const row of employeeRows ?? []) {
    ids.add(row.id);
  }

  return [...ids];
}
