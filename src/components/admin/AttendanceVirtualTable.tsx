"use client";

import { memo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { EmployeeWithAttendance } from "@/types/database";
import { formatJstDateTime } from "@/lib/format";
import { Button } from "@/components/ui/Button";

type Props = {
  records: EmployeeWithAttendance[];
  correctedSet: Set<string>;
  onEdit: (record: EmployeeWithAttendance) => void;
};

const ROW_HEIGHT = 64;

const AttendanceRow = memo(function AttendanceRow({
  row,
  isCorrected,
  onEdit,
}: {
  row: EmployeeWithAttendance;
  isCorrected: boolean;
  onEdit: (record: EmployeeWithAttendance) => void;
}) {
  return (
    <div className="grid grid-cols-[1.2fr_1fr_1.2fr_1.2fr_1fr_auto] items-center gap-2 border-b border-slate-100 px-4 text-sm hover:bg-slate-50">
      <div className="py-3 font-medium">{row.employees?.name ?? "—"}</div>
      <div className="py-3 text-slate-600">{row.employees?.stores?.name ?? "—"}</div>
      <div className="py-3">{formatJstDateTime(row.clock_in)}</div>
      <div className="py-3">{row.clock_out ? formatJstDateTime(row.clock_out) : "—"}</div>
      <div className="py-3">
        <div className="flex flex-col gap-1">
          {row.clock_out ? (
            <span className="text-slate-600">完了</span>
          ) : (
            <span className="font-medium text-blue-600">勤務中</span>
          )}
          {isCorrected && (
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
      </div>
      <div className="py-3">
        <Button type="button" variant="ghost" onClick={() => onEdit(row)}>
          修正
        </Button>
      </div>
    </div>
  );
});

export const AttendanceVirtualTable = memo(function AttendanceVirtualTable({
  records,
  correctedSet,
  onEdit,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: records.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  if (records.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white py-8 text-center text-sm text-slate-500 shadow-sm">
        該当する記録がありません
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-[1.2fr_1fr_1.2fr_1.2fr_1fr_auto] gap-2 border-b border-slate-200 bg-slate-50 px-4 text-xs font-medium text-slate-600">
        <div className="py-3">従業員</div>
        <div className="py-3">店舗</div>
        <div className="py-3">出勤</div>
        <div className="py-3">退勤</div>
        <div className="py-3">状態</div>
        <div className="py-3">操作</div>
      </div>
      <div ref={parentRef} className="max-h-[min(70vh,720px)] overflow-auto">
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = records[virtualRow.index];
            return (
              <div
                key={row.id}
                className="absolute left-0 top-0 w-full"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <AttendanceRow
                  row={row}
                  isCorrected={correctedSet.has(row.id)}
                  onEdit={onEdit}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
