import { createClient } from "@/lib/supabase/client";
import { isAllStores } from "@/lib/stores/queries";
import type { EmployeeWithAttendance, EmployeeWithStore } from "@/types/database";
import { perfLog } from "@/lib/perf/dev-logger";

const ATTENDANCE_SELECT =
  "id, employee_id, store_id, company_id, clock_in, clock_out, is_qr_clock, created_at, employees(id, name, employee_code, store_id, stores(id, name))";

const EMPLOYEE_PICKER_SELECT =
  "id, name, employee_code, store_id, hourly_rate, company_id, is_active, stores(id, name)";

export type AttendanceQueryData = {
  records: EmployeeWithAttendance[];
  employees: EmployeeWithStore[];
  correctedRecordIds: string[];
};

export async function fetchAttendanceData(
  from: string,
  to: string,
  storeId: string
): Promise<AttendanceQueryData> {
  perfLog("query-start", { key: "attendance", from, to, storeId });
  const started = performance.now();
  const supabase = createClient();

  let query = supabase
    .from("attendance_records")
    .select(ATTENDANCE_SELECT)
    .gte("clock_in", `${from}T00:00:00+09:00`)
    .lte("clock_in", `${to}T23:59:59+09:00`)
    .order("clock_in", { ascending: false })
    .limit(500);

  if (!isAllStores(storeId)) {
    query = query.eq("store_id", storeId);
  }

  const [{ data }, { data: employeesData }] = await Promise.all([
    query,
    supabase
      .from("employees")
      .select(EMPLOYEE_PICKER_SELECT)
      .eq("is_active", true)
      .order("name"),
  ]);

  const records = (data as unknown as EmployeeWithAttendance[]) ?? [];
  const recordIds = records.map((row) => row.id);
  let correctedRecordIds: string[] = [];

  if (recordIds.length > 0) {
    const { data: correctionRows } = await supabase
      .from("attendance_corrections")
      .select("attendance_record_id")
      .in("attendance_record_id", recordIds);

    correctedRecordIds = [
      ...new Set((correctionRows ?? []).map((row) => row.attendance_record_id as string)),
    ];
  }

  perfLog("query-complete", {
    key: "attendance",
    ms: Math.round(performance.now() - started),
    rows: records.length,
  });

  return {
    records,
    employees: (employeesData as unknown as EmployeeWithStore[]) ?? [],
    correctedRecordIds,
  };
}
