import type { PostgrestError } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DUPLICATE_EMPLOYEE_CODE_MESSAGE } from "@/lib/employees/constants";

export function isDuplicateEmployeeCodeError(error: PostgrestError | null): boolean {
  if (!error) return false;
  return (
    error.code === "23505" &&
    (error.message.includes("uniq_employees_company_code") ||
      error.message.includes("employees_company_id_employee_code_key") ||
      error.details?.includes("employee_code"))
  );
}

export function getEmployeeCodeErrorMessage(error: PostgrestError | null): string {
  if (isDuplicateEmployeeCodeError(error)) {
    return DUPLICATE_EMPLOYEE_CODE_MESSAGE;
  }
  return error?.message ?? "保存に失敗しました";
}

/** 同一会社内で社員コードが他従業員と重複していないか確認 */
export async function assertUniqueEmployeeCode(
  supabase: SupabaseClient,
  companyId: string,
  employeeCode: string,
  excludeEmployeeId?: string
): Promise<void> {
  const trimmed = employeeCode.trim();
  if (!trimmed) return;

  let query = supabase
    .from("employees")
    .select("id")
    .eq("company_id", companyId)
    .eq("employee_code", trimmed);

  if (excludeEmployeeId) {
    query = query.neq("id", excludeEmployeeId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (data) {
    throw new Error(DUPLICATE_EMPLOYEE_CODE_MESSAGE);
  }
}

export type DuplicateEmployeeCodeGroup = {
  companyId: string;
  employeeCode: string;
  employees: { id: string; name: string }[];
};

/** 既存データの社員コード重複を検出 */
export function findDuplicateEmployeeCodes<
  T extends { id: string; company_id: string; employee_code: string; name: string },
>(employees: T[]): DuplicateEmployeeCodeGroup[] {
  const groups = new Map<string, DuplicateEmployeeCodeGroup>();

  for (const employee of employees) {
    const code = employee.employee_code.trim();
    if (!code) continue;

    const key = `${employee.company_id}:${code}`;
    const existing = groups.get(key);
    if (existing) {
      existing.employees.push({ id: employee.id, name: employee.name });
      continue;
    }

    groups.set(key, {
      companyId: employee.company_id,
      employeeCode: code,
      employees: [{ id: employee.id, name: employee.name }],
    });
  }

  return Array.from(groups.values()).filter((group) => group.employees.length > 1);
}
