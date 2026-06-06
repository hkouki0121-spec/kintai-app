/** DBに存在する employees カラムのみで insert/update ペイロードを組み立てる */
export type EmployeeFormPayload = {
  name: string;
  employeeCode: string;
  storeId: string;
  companyId: string;
  hourlyRate: number;
};

export function buildEmployeeInsertPayload(data: EmployeeFormPayload) {
  return {
    name: data.name.trim(),
    employee_code: data.employeeCode.trim(),
    store_id: data.storeId,
    company_id: data.companyId,
    hourly_rate: data.hourlyRate,
  };
}

export function buildEmployeeUpdatePayload(data: EmployeeFormPayload) {
  return {
    name: data.name.trim(),
    employee_code: data.employeeCode.trim(),
    store_id: data.storeId,
    company_id: data.companyId,
    hourly_rate: data.hourlyRate,
  };
}
