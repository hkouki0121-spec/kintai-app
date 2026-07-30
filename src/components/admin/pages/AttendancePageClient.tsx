"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";
import { getCurrentMonthDateRangeInJst } from "@/lib/attendance/date-range";
import { useActiveStoresQuery, useAttendanceQuery, useShowPageSkeleton } from "@/lib/queries/hooks";
import { ALL_STORES_VALUE } from "@/lib/stores/constants";

const AttendanceTable = dynamic(
  () => import("@/components/admin/AttendanceTable").then((m) => ({ default: m.AttendanceTable })),
  { ssr: false }
);

function AttendancePageInner() {
  const searchParams = useSearchParams();
  const defaultRange = getCurrentMonthDateRangeInJst();
  const storeId = searchParams.get("store") ?? ALL_STORES_VALUE;
  const from = searchParams.get("from") ?? defaultRange.from;
  const to = searchParams.get("to") ?? defaultRange.to;

  const { activeStores } = useActiveStoresQuery();
  const { data } = useAttendanceQuery(from, to, storeId);
  const ready = !!data;
  const showSkeleton = useShowPageSkeleton(ready, "/admin/attendance");

  if (showSkeleton) {
    return <AdminPageSkeleton pathname="/admin/attendance" variant="table" />;
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">勤怠履歴</h2>
        <p className="text-sm text-slate-600">
          店舗・期間で出勤・退勤の記録を確認できます。管理者のみ勤怠の修正・手動登録が可能です。
        </p>
      </div>
      <AttendanceTable
        records={data.records}
        stores={activeStores}
        employees={data.employees}
        correctedRecordIds={data.correctedRecordIds}
        storeId={storeId}
        from={from}
        to={to}
      />
    </div>
  );
}

export function AttendancePageClient() {
  return (
    <Suspense fallback={null}>
      <AttendancePageInner />
    </Suspense>
  );
}
