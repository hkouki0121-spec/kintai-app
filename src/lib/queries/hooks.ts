"use client";

import { useQuery } from "@tanstack/react-query";
import { adminQueryKeys } from "@/lib/queries/keys";
import { authQueryOptions } from "@/lib/queries/defaults";
import { fetchCompanyContext } from "@/lib/queries/fetch-company-context";
import { fetchStoresForClient } from "@/lib/queries/fetch-stores";
import { fetchEmployeesList } from "@/lib/queries/fetch-employees";
import { fetchDashboardData } from "@/lib/queries/fetch-dashboard";
import { fetchAttendanceData } from "@/lib/queries/fetch-attendance";
import { fetchPayrollList } from "@/lib/queries/fetch-payroll";
import { fetchStoreManagerData } from "@/lib/queries/fetch-store-manager";

export function useCompanyContextQuery() {
  return useQuery({
    queryKey: adminQueryKeys.companyContext,
    queryFn: fetchCompanyContext,
    ...authQueryOptions,
  });
}

export function useStoresQuery() {
  return useQuery({
    queryKey: adminQueryKeys.stores,
    queryFn: fetchStoresForClient,
  });
}

export function useActiveStoresQuery() {
  const query = useStoresQuery();
  const activeStores =
    query.data?.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name })) ?? [];
  return { ...query, activeStores };
}

export function useEmployeesQuery() {
  return useQuery({
    queryKey: adminQueryKeys.employees,
    queryFn: fetchEmployeesList,
  });
}

export function useDashboardQuery(storeId: string) {
  return useQuery({
    queryKey: adminQueryKeys.dashboard(storeId),
    queryFn: () => fetchDashboardData(storeId),
  });
}

export function useAttendanceQuery(from: string, to: string, storeId: string) {
  return useQuery({
    queryKey: adminQueryKeys.attendance(from, to, storeId),
    queryFn: () => fetchAttendanceData(from, to, storeId),
  });
}

export function usePayrollQuery(year: number, month: number, storeId: string) {
  return useQuery({
    queryKey: adminQueryKeys.payroll(year, month, storeId),
    queryFn: () => fetchPayrollList(year, month, storeId),
  });
}

export function useStoreManagerQuery(isSuperAdmin: boolean) {
  return useQuery({
    queryKey: adminQueryKeys.storeManager,
    queryFn: () => fetchStoreManagerData(isSuperAdmin),
  });
}
