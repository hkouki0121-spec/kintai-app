"use client";

import dynamic from "next/dynamic";
import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";
import { useEmployeesQuery, useShowPageSkeleton, useStoresQuery } from "@/lib/queries/hooks";

const EmployeeManager = dynamic(
  () => import("@/components/admin/EmployeeManager").then((m) => ({ default: m.EmployeeManager })),
  { ssr: false }
);

export function EmployeesPageClient() {
  const { data: stores } = useStoresQuery();
  const { data } = useEmployeesQuery();
  const ready = !!(stores && data);
  const showSkeleton = useShowPageSkeleton(ready, "/admin/employees");

  if (showSkeleton) {
    return <AdminPageSkeleton pathname="/admin/employees" variant="table" />;
  }

  if (!stores || !data) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">従業員一覧</h2>
        <p className="mt-1 text-sm text-slate-500">店舗ごとに従業員を管理できます</p>
      </div>
      <EmployeeManager employees={data.employees} stores={stores} duplicateCodes={data.duplicateCodes} />
    </div>
  );
}
