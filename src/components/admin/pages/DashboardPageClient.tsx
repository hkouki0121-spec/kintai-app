"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardContent } from "@/components/admin/DashboardContent";
import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";
import { useActiveStoresQuery, useDashboardQuery } from "@/lib/queries/hooks";
import { ALL_STORES_VALUE } from "@/lib/stores/constants";

function DashboardPageInner() {
  const searchParams = useSearchParams();
  const storeId = searchParams.get("store") ?? ALL_STORES_VALUE;
  const { activeStores, isLoading: storesLoading, data: storesData } = useActiveStoresQuery();
  const { data, isLoading: dashLoading } = useDashboardQuery(storeId);

  const isFirstLoad = (storesLoading && !storesData) || (dashLoading && !data);
  if (isFirstLoad) {
    return <AdminPageSkeleton pathname="/admin/dashboard" variant="dashboard" />;
  }

  if (!data) {
    return <p className="text-sm text-slate-500">読み込みに失敗しました</p>;
  }

  return (
    <DashboardContent
      stores={activeStores}
      employeeCount={data.employeeCount}
      openAttendance={data.openAttendance}
      recent={data.recent}
    />
  );
}

export function DashboardPageClient() {
  return (
    <Suspense fallback={<AdminPageSkeleton pathname="/admin/dashboard" variant="dashboard" />}>
      <DashboardPageInner />
    </Suspense>
  );
}
