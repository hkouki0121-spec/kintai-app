import { ALL_STORES_VALUE } from "@/lib/stores/constants";
import type { EmployeeWithStore, Store } from "@/types/database";

function compareEmployees(a: EmployeeWithStore, b: EmployeeWithStore): number {
  const codeA = a.employee_code.trim();
  const codeB = b.employee_code.trim();

  if (codeA && codeB) {
    const byCode = codeA.localeCompare(codeB, "ja");
    if (byCode !== 0) return byCode;
  } else if (codeA && !codeB) {
    return -1;
  } else if (!codeA && codeB) {
    return 1;
  }

  return a.name.localeCompare(b.name, "ja");
}

export type EmployeeStoreGroup = {
  storeId: string;
  storeName: string;
  employees: EmployeeWithStore[];
};

/** 店舗名順にグループ化し、店舗内は社員コード順（未設定時は名前順） */
export function groupEmployeesByStore(
  employees: EmployeeWithStore[],
  stores: Pick<Store, "id" | "name">[],
  filterStoreId: string = ALL_STORES_VALUE
): EmployeeStoreGroup[] {
  const filtered =
    filterStoreId === ALL_STORES_VALUE
      ? employees
      : employees.filter((employee) => employee.store_id === filterStoreId);

  const storeNameById = new Map(stores.map((store) => [store.id, store.name]));
  const grouped = new Map<string, EmployeeWithStore[]>();

  for (const employee of filtered) {
    const list = grouped.get(employee.store_id) ?? [];
    list.push(employee);
    grouped.set(employee.store_id, list);
  }

  return Array.from(grouped.entries())
    .map(([storeId, storeEmployees]) => ({
      storeId,
      storeName: storeNameById.get(storeId) ?? storeEmployees[0]?.stores?.name ?? "（店舗不明）",
      employees: [...storeEmployees].sort(compareEmployees),
    }))
    .sort((a, b) => a.storeName.localeCompare(b.storeName, "ja"));
}
