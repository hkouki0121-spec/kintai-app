import { createClient } from "@/lib/supabase/client";
import { EMPLOYEE_LIST_SELECT_COLUMNS } from "@/lib/employees/constants";
import { findDuplicateEmployeeCodes } from "@/lib/employees/duplicate-code";
import type { EmployeeWithStore } from "@/types/database";
import { perfLog } from "@/lib/perf/dev-logger";

export type EmployeesQueryData = {
  employees: EmployeeWithStore[];
  duplicateCodes: ReturnType<typeof findDuplicateEmployeeCodes>;
};

export async function fetchEmployeesList(): Promise<EmployeesQueryData> {
  perfLog("query-start", { key: "employees" });
  const started = performance.now();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("employees")
    .select(`${EMPLOYEE_LIST_SELECT_COLUMNS}, stores(id, name)`)
    .order("name");
  if (error) throw error;
  const employees = (data as unknown as EmployeeWithStore[]) ?? [];
  perfLog("query-complete", {
    key: "employees",
    ms: Math.round(performance.now() - started),
    rows: employees.length,
  });
  return {
    employees,
    duplicateCodes: findDuplicateEmployeeCodes(employees),
  };
}
