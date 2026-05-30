import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { AttendanceTable } from "@/components/admin/AttendanceTable";
import type { EmployeeWithAttendance } from "@/types/database";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("attendance_records")
    .select("*, employees(id, name, employee_code, hourly_rate)")
    .order("clock_in", { ascending: false })
    .limit(200);

  if (params.from) {
    query = query.gte("clock_in", `${params.from}T00:00:00+09:00`);
  }
  if (params.to) {
    query = query.lte("clock_in", `${params.to}T23:59:59+09:00`);
  }

  const { data } = await query;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">勤怠履歴</h2>
        <p className="text-sm text-slate-600">出勤・退勤の記録を確認できます</p>
      </div>
      <Suspense fallback={<p className="text-sm text-slate-500">読み込み中…</p>}>
        <AttendanceTable records={(data as EmployeeWithAttendance[]) ?? []} />
      </Suspense>
    </div>
  );
}
