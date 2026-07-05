import { createClient } from "@/lib/supabase/server";
import { AttendanceTable } from "@/components/admin/AttendanceTable";
import { getCurrentMonthDateRangeInJst } from "@/lib/attendance/date-range";
import { fetchActiveStores, isAllStores } from "@/lib/stores/queries";
import { ALL_STORES_VALUE } from "@/lib/stores/constants";
import type { EmployeeWithAttendance, EmployeeWithStore } from "@/types/database";

const ATTENDANCE_SELECT =
  "id, employee_id, store_id, company_id, clock_in, clock_out, is_qr_clock, created_at, employees(id, name, employee_code, store_id, stores(id, name))";

const EMPLOYEE_PICKER_SELECT = "id, name, employee_code, store_id, hourly_rate, company_id, is_active, stores(id, name)";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; store?: string }>;
}) {
  const params = await searchParams;
  const storeId = params.store ?? ALL_STORES_VALUE;
  const defaultRange = getCurrentMonthDateRangeInJst();
  const from = params.from ?? defaultRange.from;
  const to = params.to ?? defaultRange.to;

  const supabase = await createClient();
  const stores = await fetchActiveStores(supabase);

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">勤怠履歴</h2>
        <p className="text-sm text-slate-600">
          店舗・期間で出勤・退勤の記録を確認できます。管理者のみ勤怠の修正・手動登録が可能です。
        </p>
      </div>
      <AttendanceTable
        records={records}
        stores={stores}
        employees={(employeesData as unknown as EmployeeWithStore[]) ?? []}
        correctedRecordIds={correctedRecordIds}
        initialStoreId={storeId}
        initialFrom={from}
        initialTo={to}
      />
    </div>
  );
}
