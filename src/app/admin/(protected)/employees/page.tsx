import { createClient } from "@/lib/supabase/server";
import { EmployeeManager } from "@/components/admin/EmployeeManager";
import { EMPLOYEE_LIST_SELECT_COLUMNS } from "@/lib/employees/constants";
import { findDuplicateEmployeeCodes } from "@/lib/employees/duplicate-code";
import type { EmployeeWithStore } from "@/types/database";

export default async function EmployeesPage() {
  const supabase = await createClient();
  const [{ data: allStores }, { data }] = await Promise.all([
    supabase.from("stores").select("id, name, is_active, company_id").order("name"),
    supabase
      .from("employees")
      .select(`${EMPLOYEE_LIST_SELECT_COLUMNS}, stores(id, name)`)
      .order("name"),
  ]);
  const stores = allStores ?? [];
  const employees = (data as unknown as EmployeeWithStore[]) ?? [];
  const duplicateCodes = findDuplicateEmployeeCodes(employees);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">従業員一覧</h2>
        <p className="mt-1 text-sm text-slate-500">店舗ごとに従業員を管理できます</p>
      </div>
      <EmployeeManager
        initialEmployees={employees}
        stores={stores}
        duplicateCodes={duplicateCodes}
      />
    </div>
  );
}
