import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [{ count: employeeCount }, { count: openAttendance }, { data: recent }] =
    await Promise.all([
      supabase.from("employees").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .is("clock_out", null),
      supabase
        .from("attendance_records")
        .select("clock_in, employees(name)")
        .order("clock_in", { ascending: false })
        .limit(5),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">ダッシュボード</h2>
        <p className="text-sm text-slate-600">勤怠・給与の概要</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">在籍従業員</p>
          <p className="mt-1 text-3xl font-bold">{employeeCount ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">現在出勤中</p>
          <p className="mt-1 text-3xl font-bold text-blue-600">{openAttendance ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">クイックリンク</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li>
              <Link href="/admin/employees" className="text-blue-600 hover:underline">
                従業員を管理
              </Link>
            </li>
            <li>
              <Link href="/admin/payroll" className="text-blue-600 hover:underline">
                給与を計算
              </Link>
            </li>
          </ul>
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold text-slate-900">直近の打刻</h3>
        <ul className="mt-3 divide-y divide-slate-100">
          {(recent ?? []).map((row, i) => {
            const emp = row.employees as { name: string } | null;
            return (
              <li key={i} className="flex justify-between py-2 text-sm">
                <span>{emp?.name ?? "—"}</span>
                <span className="text-slate-500">
                  {new Date(row.clock_in).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                </span>
              </li>
            );
          })}
          {(!recent || recent.length === 0) && (
            <li className="py-4 text-center text-sm text-slate-500">記録がありません</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
