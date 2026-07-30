"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardContent } from "@/components/admin/DashboardContent";
import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";
import { useActiveStoresQuery, useDashboardQuery, useShowPageSkeleton } from "@/lib/queries/hooks";
import { ALL_STORES_VALUE } from "@/lib/stores/constants";

function DashboardPageInner() {
  const searchParams = useSearchParams();
  const storeId = searchParams.get("store") ?? ALL_STORES_VALUE;
  const { activeStores } = useActiveStoresQuery();
  const { data } = useDashboardQuery(storeId);
  const ready = !!data;
  const showSkeleton = useShowPageSkeleton(ready, "/admin/dashboard");

  if (showSkeleton) {
    return <AdminPageSkeleton pathname="/admin/dashboard" variant="dashboard" />;
  }

  if (!data) return null;

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
    <Suspense fallback={null}>
      <DashboardPageInner />
    </Suspense>
  );
}
