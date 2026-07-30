"use client";

import type { QueryClient } from "@tanstack/react-query";
import { getCurrentMonthDateRangeInJst } from "@/lib/attendance/date-range";
import { adminQueryKeys } from "@/lib/queries/keys";
import { fetchStoresForClient } from "@/lib/queries/fetch-stores";
import { fetchEmployeesList } from "@/lib/queries/fetch-employees";
import { fetchDashboardData } from "@/lib/queries/fetch-dashboard";
import { fetchAttendanceData } from "@/lib/queries/fetch-attendance";
import { fetchPayrollList } from "@/lib/queries/fetch-payroll";
import { fetchStoreManagerData } from "@/lib/queries/fetch-store-manager";
import { ALL_STORES_VALUE } from "@/lib/stores/constants";

export function prefetchAdminRoute(
  queryClient: QueryClient,
  href: string,
  isSuperAdmin: boolean
): void {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const { from, to } = getCurrentMonthDateRangeInJst();

  if (href.startsWith("/admin/dashboard")) {
    void queryClient.prefetchQuery({
      queryKey: adminQueryKeys.dashboard(ALL_STORES_VALUE),
      queryFn: () => fetchDashboardData(ALL_STORES_VALUE),
    });
    return;
  }
  if (href.startsWith("/admin/employees")) {
    void queryClient.prefetchQuery({ queryKey: adminQueryKeys.stores, queryFn: fetchStoresForClient });
    void queryClient.prefetchQuery({ queryKey: adminQueryKeys.employees, queryFn: fetchEmployeesList });
    return;
  }
  if (href.startsWith("/admin/payroll")) {
    void queryClient.prefetchQuery({
      queryKey: adminQueryKeys.payroll(year, month, ALL_STORES_VALUE),
      queryFn: () => fetchPayrollList(year, month, ALL_STORES_VALUE),
    });
    return;
  }
  if (href.startsWith("/admin/attendance")) {
    void queryClient.prefetchQuery({
      queryKey: adminQueryKeys.attendance(from, to, ALL_STORES_VALUE),
      queryFn: () => fetchAttendanceData(from, to, ALL_STORES_VALUE),
    });
    return;
  }
  if (href.startsWith("/admin/stores")) {
    void queryClient.prefetchQuery({
      queryKey: adminQueryKeys.storeManager,
      queryFn: () => fetchStoreManagerData(isSuperAdmin),
    });
  }
}
