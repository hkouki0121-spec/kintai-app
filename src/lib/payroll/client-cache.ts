import type { PayrollWithEmployee } from "@/types/database";

const PREFIX = "payroll:v1:";

function cacheKey(year: number, month: number, storeId: string): string {
  return `${PREFIX}${year}:${month}:${storeId}`;
}

export function readPayrollCache(
  year: number,
  month: number,
  storeId: string
): PayrollWithEmployee[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(year, month, storeId));
    if (!raw) return null;
    return JSON.parse(raw) as PayrollWithEmployee[];
  } catch {
    return null;
  }
}

export function writePayrollCache(
  year: number,
  month: number,
  storeId: string,
  payroll: PayrollWithEmployee[]
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(cacheKey(year, month, storeId), JSON.stringify(payroll));
  } catch {
    // ignore
  }
}
