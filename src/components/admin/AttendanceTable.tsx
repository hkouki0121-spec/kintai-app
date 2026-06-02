"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmployeeWithAttendance, EmployeeWithStore, Store } from "@/types/database";
import { formatJstDateTime } from "@/lib/format";
import { ALL_STORES_VALUE } from "@/lib/stores/constants";
import { StoreSelect } from "@/components/admin/StoreSelect";
import { AttendanceEditModal } from "@/components/admin/AttendanceEditModal";
import { AttendanceManualCreateModal } from "@/components/admin/AttendanceManualCreateModal";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Props = {
  records: EmployeeWithAttendance[];
  stores: Pick<Store, "id" | "name">[];
  employees: EmployeeWithStore[];
  correctedRecordIds: string[];
  initialStoreId: string;
};

export function AttendanceTable({
  records,
  stores,
  employees,
  correctedRecordIds,
  initialStoreId,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const [storeId, setStoreId] = useState(searchParams.get("store") ?? initialStoreId);
  const [editingRecord, setEditingRecord] = useState<EmployeeWithAttendance | null>(null);
  const [showManualCreate, setShowManualCreate] = useState(false);
  const correctedSet = new Set(correctedRecordIds);

  const applyFilter = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    const f = fd.get("from") as string;
    const t = fd.get("to") as string;
    if (f) params.set("from", f);
    if (t) params.set("to", t);
    if (storeId && storeId !== ALL_STORES_VALUE) params.set("store", storeId);
    router.push(`/admin/attendance?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={applyFilter} className="flex flex-wrap items-end gap-3">
          <StoreSelect stores={stores} value={storeId} onChange={setStoreId} label="店舗" />
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
          <Button type="button" onClick={() => setShowManualCreate(true)}>
            手動登録
          </Button>
        </form>
      </Card>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">従業員</th>
              <th className="px-4 py-3 font-medium">店舗</th>
              <th className="px-4 py-3 font-medium">出勤</th>
              <th className="px-4 py-3 font-medium">退勤</th>
              <th className="px-4 py-3 font-medium">状態</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{row.employees?.name ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {row.employees?.stores?.name ?? "—"}
                </td>
                <td className="px-4 py-3">{formatJstDateTime(row.clock_in)}</td>
                <td className="px-4 py-3">
                  {row.clock_out ? formatJstDateTime(row.clock_out) : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    {row.clock_out ? (
                      <span className="text-slate-600">完了</span>
                    ) : (
                      <span className="font-medium text-blue-600">勤務中</span>
                    )}
                    {correctedSet.has(row.id) && (
                      <span className="w-fit rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                        修正済み
                      </span>
                    )}
                    {row.is_qr_clock && (
                      <span className="w-fit rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        QR打刻
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Button type="button" variant="ghost" onClick={() => setEditingRecord(row)}>
                    修正
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">該当する記録がありません</p>
        )}
      </div>

      {editingRecord && (
        <AttendanceEditModal
          record={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSaved={() => {
            setEditingRecord(null);
            router.refresh();
          }}
        />
      )}

      {showManualCreate && (
        <AttendanceManualCreateModal
          employees={employees}
          onClose={() => setShowManualCreate(false)}
          onSaved={() => {
            setShowManualCreate(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
