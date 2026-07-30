"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { EmployeeWithAttendance, EmployeeWithStore, Store } from "@/types/database";
import { ALL_STORES_VALUE } from "@/lib/stores/constants";
import { invalidateAttendance } from "@/lib/queries/invalidate";
import { StoreSelect } from "@/components/admin/StoreSelect";
import { AttendanceEditModal } from "@/components/admin/AttendanceEditModal";
import { AttendanceManualCreateModal } from "@/components/admin/AttendanceManualCreateModal";
import { AttendanceVirtualTable } from "@/components/admin/AttendanceVirtualTable";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Props = {
  records: EmployeeWithAttendance[];
  stores: Pick<Store, "id" | "name">[];
  employees: EmployeeWithStore[];
  correctedRecordIds: string[];
  storeId: string;
  from: string;
  to: string;
};

export function AttendanceTable({
  records,
  stores,
  employees,
  correctedRecordIds,
  storeId: initialStoreId,
  from: initialFrom,
  to: initialTo,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [storeId, setStoreId] = useState(initialStoreId);
  const [editingRecord, setEditingRecord] = useState<EmployeeWithAttendance | null>(null);
  const [showManualCreate, setShowManualCreate] = useState(false);
  const correctedSet = useMemo(() => new Set(correctedRecordIds), [correctedRecordIds]);

  useEffect(() => {
    setStoreId(initialStoreId);
  }, [initialStoreId]);

  const handleEdit = useCallback((record: EmployeeWithAttendance) => {
    setEditingRecord(record);
  }, []);

  const invalidateCurrent = useCallback(async () => {
    await invalidateAttendance(queryClient, initialFrom, initialTo, initialStoreId);
  }, [queryClient, initialFrom, initialTo, initialStoreId]);

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
            <Input type="date" name="from" defaultValue={initialFrom} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">終了日</label>
            <Input type="date" name="to" defaultValue={initialTo} />
          </div>
          <Button type="submit" variant="secondary">
            絞り込み
          </Button>
          <Button type="button" onClick={() => setShowManualCreate(true)}>
            手動登録
          </Button>
        </form>
      </Card>

      <AttendanceVirtualTable records={records} correctedSet={correctedSet} onEdit={handleEdit} />

      {editingRecord && (
        <AttendanceEditModal
          record={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSaved={async () => {
            setEditingRecord(null);
            await invalidateCurrent();
          }}
        />
      )}

      {showManualCreate && (
        <AttendanceManualCreateModal
          employees={employees}
          onClose={() => setShowManualCreate(false)}
          onSaved={async () => {
            setShowManualCreate(false);
            await invalidateCurrent();
          }}
        />
      )}
    </div>
  );
}
