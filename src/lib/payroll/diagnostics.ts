import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateEmployeePayroll } from "@/lib/payroll/calculate";
import { getJstMonthBounds } from "@/lib/payroll/jst-month";
import { getPayrollSettings } from "@/lib/payroll/settings";
import { isAllStores } from "@/lib/stores/queries";

export type PayrollDiagnosticItem = {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  closedRecords: number;
  openRecords: number;
  calculatedTotalHours: number;
  payrollTotalHours: number;
  issues: string[];
};

export type PayrollDiagnostics = {
  year: number;
  month: number;
  roundingMinutes: number;
  items: PayrollDiagnosticItem[];
  summary: {
    employeesWithAttendance: number;
    employeesWithOpenShifts: number;
    employeesWithZeroPayroll: number;
    totalOpenShifts: number;
  };
};

export async function getPayrollDiagnostics(
  supabase: SupabaseClient,
  year: number,
  month: number,
  storeId?: string | null,
  companyId?: string | null
): Promise<PayrollDiagnostics> {
  const { start: monthStart, end: monthEnd } = getJstMonthBounds(year, month);

  let employeeQuery = supabase
    .from("employees")
    .select("id, name, employee_code, hourly_rate, company_id, is_active")
    .eq("is_active", true);

  if (!isAllStores(storeId)) {
    employeeQuery = employeeQuery.eq("store_id", storeId!);
  }
  if (companyId) {
    employeeQuery = employeeQuery.eq("company_id", companyId);
  }

  const { data: employees } = await employeeQuery;
  const companyIds = [...new Set((employees ?? []).map((emp) => emp.company_id))];
  let roundingMinutes = 30;

  if (companyId) {
    const { data: company } = await supabase
      .from("companies")
      .select("payroll_rounding_minutes")
      .eq("id", companyId)
      .maybeSingle();
    roundingMinutes = company?.payroll_rounding_minutes ?? 30;
  } else if (companyIds.length === 1) {
    const { data: company } = await supabase
      .from("companies")
      .select("payroll_rounding_minutes")
      .eq("id", companyIds[0])
      .maybeSingle();
    roundingMinutes = company?.payroll_rounding_minutes ?? 30;
  }

  const settings = getPayrollSettings(roundingMinutes);
  const items: PayrollDiagnosticItem[] = [];

  for (const emp of employees ?? []) {
    const { data: records } = await supabase
      .from("attendance_records")
      .select("clock_in, clock_out")
      .eq("employee_id", emp.id)
      .lt("clock_in", monthEnd.toISOString())
      .or(`clock_out.gt.${monthStart.toISOString()},clock_out.is.null`);

    const allRecords = records ?? [];
    const openRecords = allRecords.filter((r) => !r.clock_out).length;
    const closedRecords = allRecords.length - openRecords;

    const result = calculateEmployeePayroll(
      emp.id,
      Number(emp.hourly_rate),
      allRecords,
      year,
      month,
      settings
    );

    const payrollTotalHours = result.regularHours + result.nightHours;
    const issues: string[] = [];

    if (openRecords > 0) {
      issues.push(`退勤未打刻が${openRecords}件あります`);
    }
    if (closedRecords > 0 && payrollTotalHours === 0) {
      issues.push("勤怠はあるが給与計算時間が0です（区切り単位未満の可能性）");
    }
    if (allRecords.length === 0) {
      continue;
    }

    items.push({
      employeeId: emp.id,
      employeeName: emp.name,
      employeeCode: emp.employee_code,
      closedRecords,
      openRecords,
      calculatedTotalHours: result.actualTotalHours,
      payrollTotalHours,
      issues,
    });
  }

  const withIssues = items.filter((item) => item.issues.length > 0);

  return {
    year,
    month,
    roundingMinutes,
    items: withIssues,
    summary: {
      employeesWithAttendance: items.length,
      employeesWithOpenShifts: items.filter((item) => item.openRecords > 0).length,
      employeesWithZeroPayroll: items.filter((item) => item.closedRecords > 0 && item.payrollTotalHours === 0).length,
      totalOpenShifts: items.reduce((sum, item) => sum + item.openRecords, 0),
    },
  };
}
