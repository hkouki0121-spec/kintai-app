import type { CompanyContext } from "@/lib/auth/company-context";

const STORAGE_KEY = "admin:company-context";

export function readCachedCompanyContext(): CompanyContext | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CompanyContext) : undefined;
  } catch {
    return undefined;
  }
}

export function writeCachedCompanyContext(context: CompanyContext): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  } catch {
    // ignore
  }
}

export function clearCachedCompanyContext(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
