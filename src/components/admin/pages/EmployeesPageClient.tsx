"use client";

import { EmployeeManager } from "@/components/admin/EmployeeManager";
import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";
import { useEmployeesQuery, useStoresQuery } from "@/lib/queries/hooks";

export function EmployeesPageClient() {
  const { data: stores, isLoading: storesLoading } = useStoresQuery();
  const { data, isLoading: employeesLoading } = useEmployeesQuery();

  const isFirstLoad = (storesLoading && !stores) || (employeesLoading && !data);
  if (isFirstLoad) {
    return <AdminPageSkeleton pathname="/admin/employees" variant="table" />;
  }

  if (!stores || !data) {
    return <p className="text-sm text-slate-500">読み込みに失敗しました</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">従業員一覧</h2>
        <p className="mt-1 text-sm text-slate-500">店舗ごとに従業員を管理できます</p>
      </div>
      <EmployeeManager
        employees={data.employees}
        stores={stores}
        duplicateCodes={data.duplicateCodes}
      />
    </div>
  );
}
