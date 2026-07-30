import { ALL_STORES_VALUE } from "@/lib/stores/constants";
import type { PayrollWithEmployee } from "@/types/database";
import { perfLog } from "@/lib/perf/dev-logger";

export async function fetchPayrollList(
  year: number,
  month: number,
  storeId: string
): Promise<PayrollWithEmployee[]> {
  perfLog("query-start", { key: "payroll", year, month, storeId });
  const started = performance.now();
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
    storeId,
  });
  const res = await fetch(`/api/admin/payroll/list?${params.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("給与一覧の取得に失敗しました");
  }
  const data = (await res.json()) as { payroll?: PayrollWithEmployee[] };
  const rows = data.payroll ?? [];
  perfLog("query-complete", {
    key: "payroll",
    ms: Math.round(performance.now() - started),
    rows: rows.length,
  });
  return rows;
}

export function parsePayrollStoreId(store?: string | null): string {
  return store && store.length > 0 ? store : ALL_STORES_VALUE;
}
