"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { EmployeeWithAttendance } from "@/types/database";
import { formatJstDateTime } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Props = {
  records: EmployeeWithAttendance[];
};

export function AttendanceTable({ records }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const applyFilter = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    const f = fd.get("from") as string;
    const t = fd.get("to") as string;
    if (f) params.set("from", f);
    if (t) params.set("to", t);
    router.push(`/admin/attendance?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={applyFilter} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm text-slate-600">開始日</label>
            <Input type="date" name="from" defaultValue={from} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">終了日</label>
            <Input type="date" name="to" defaultValue={to} />
          </div>
          <Button type="submit" variant="secondary">
            絞り込み
          </Button>
        </form>
      </Card>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">従業員</th>
              <th className="px-4 py-3 font-medium">出勤</th>
              <th className="px-4 py-3 font-medium">退勤</th>
              <th className="px-4 py-3 font-medium">状態</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{row.employees?.name ?? "—"}</td>
                <td className="px-4 py-3">{formatJstDateTime(row.clock_in)}</td>
                <td className="px-4 py-3">
                  {row.clock_out ? formatJstDateTime(row.clock_out) : "—"}
                </td>
                <td className="px-4 py-3">
                  {row.clock_out ? (
                    <span className="text-slate-600">完了</span>
                  ) : (
                    <span className="font-medium text-blue-600">勤務中</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">該当する記録がありません</p>
        )}
      </div>
    </div>
  );
}
