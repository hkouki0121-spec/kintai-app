export const adminQueryKeys = {
  companyContext: ["admin", "company-context"] as const,
  stores: ["admin", "stores"] as const,
  storeManager: ["admin", "store-manager"] as const,
  employees: ["admin", "employees"] as const,
  dashboard: (storeId: string) => ["admin", "dashboard", storeId] as const,
  payroll: (year: number, month: number, storeId: string) =>
    ["admin", "payroll", year, month, storeId] as const,
  attendance: (from: string, to: string, storeId: string) =>
    ["admin", "attendance", from, to, storeId] as const,
  lineConfig: ["admin", "line-config"] as const,
};
