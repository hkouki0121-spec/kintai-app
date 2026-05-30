import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { AttendanceTable } from "@/components/admin/AttendanceTable";
import { fetchActiveStores, isAllStores } from "@/lib/stores/queries";
import { ALL_STORES_VALUE } from "@/lib/stores/constants";
import type { EmployeeWithAttendance } from "@/types/database";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; store?: string }>;
}) {
  const params = await searchParams;
  const storeId = params.store ?? ALL_STORES_VALUE;
  const supabase = await createClient();
  const stores = await fetchActiveStores(supabase);

  let query = supabase
    .from("attendance_records")
    .select("*, employees(id, name, employee_code, hourly_rate, store_id, stores(id, name))")
    .order("clock_in", { ascending: false })
    .limit(200);

  if (params.from) {
    query = query.gte("clock_in", `${params.from}T00:00:00+09:00`);
  }
  if (params.to) {
    query = query.lte("clock_in", `${params.to}T23:59:59+09:00`);
  }
  if (!isAllStores(storeId)) {
    query = query.eq("store_id", storeId);
  }

  const { data } = await query;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">勤怠履歴</h2>
        <p className="text-sm text-slate-600">店舗・期間で出勤・退勤の記録を確認できます</p>
      </div>
      <Suspense fallback={<p className="text-sm text-slate-500">読み込み中…</p>}>
        <AttendanceTable
          records={(data as EmployeeWithAttendance[]) ?? []}
          stores={stores}
          initialStoreId={storeId}
        />
      </Suspense>
    </div>
  );
}
