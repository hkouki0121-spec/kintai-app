"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { getCurrentMonthDateRangeInJst } from "@/lib/attendance/date-range";
import { adminQueryKeys } from "@/lib/queries/keys";
import { fetchStoresForClient } from "@/lib/queries/fetch-stores";
import { fetchEmployeesList } from "@/lib/queries/fetch-employees";
import { fetchDashboardData } from "@/lib/queries/fetch-dashboard";
import { fetchAttendanceData } from "@/lib/queries/fetch-attendance";
import { fetchPayrollList } from "@/lib/queries/fetch-payroll";
import { fetchStoreManagerData } from "@/lib/queries/fetch-store-manager";
import { ALL_STORES_VALUE } from "@/lib/stores/constants";
import { useAdminCompany } from "@/components/admin/AdminCompanyProvider";
import { KEEP_ALIVE_ROUTES } from "@/components/admin/AdminNavigationProvider";

/** 初回描画のあと、アイドル時に他ページデータをプリフェッチする */
export function AdminDataPrefetch() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { isSuperAdmin } = useAdminCompany();

  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const { from, to } = getCurrentMonthDateRangeInJst();

    const prefetch = () => {
      void queryClient.prefetchQuery({
        queryKey: adminQueryKeys.stores,
        queryFn: fetchStoresForClient,
      });
      void queryClient.prefetchQuery({
        queryKey: adminQueryKeys.employees,
        queryFn: fetchEmployeesList,
      });
      void queryClient.prefetchQuery({
        queryKey: adminQueryKeys.dashboard(ALL_STORES_VALUE),
        queryFn: () => fetchDashboardData(ALL_STORES_VALUE),
      });
      void queryClient.prefetchQuery({
        queryKey: adminQueryKeys.payroll(year, month, ALL_STORES_VALUE),
        queryFn: () => fetchPayrollList(year, month, ALL_STORES_VALUE),
      });
      void queryClient.prefetchQuery({
        queryKey: adminQueryKeys.attendance(from, to, ALL_STORES_VALUE),
        queryFn: () => fetchAttendanceData(from, to, ALL_STORES_VALUE),
      });
      void queryClient.prefetchQuery({
        queryKey: adminQueryKeys.storeManager,
        queryFn: () => fetchStoreManagerData(isSuperAdmin),
      });
      for (const route of KEEP_ALIVE_ROUTES) {
        router.prefetch(route);
      }
    };

    let idleId = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(prefetch, { timeout: 2000 });
    } else {
      timeoutId = setTimeout(prefetch, 400);
    }

    return () => {
      if (idleId && "cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [queryClient, isSuperAdmin, router]);

  return null;
}
