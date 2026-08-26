import type { QueryClient } from "@tanstack/react-query";
import { adminQueryKeys } from "@/lib/queries/keys";
import { clearCachedCompanyContext } from "@/lib/queries/company-context-cache";

export async function invalidateEmployees(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: adminQueryKeys.employees });
}

export async function invalidateStores(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: adminQueryKeys.stores });
  await queryClient.invalidateQueries({ queryKey: adminQueryKeys.storeManager });
}

export async function invalidateDashboard(
  queryClient: QueryClient,
  storeId: string
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: adminQueryKeys.dashboard(storeId) });
}

export async function invalidateAttendance(
  queryClient: QueryClient,
  from: string,
  to: string,
  storeId: string
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: adminQueryKeys.attendance(from, to, storeId),
  });
}

export async function invalidatePayroll(
  queryClient: QueryClient,
  year: number,
  month: number,
  storeId: string
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: adminQueryKeys.payroll(year, month, storeId),
  });
}

/** ログアウト時のみ全 admin キャッシュを破棄 */
export function clearAdminCache(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: ["admin"] });
  clearCachedCompanyContext();
}
