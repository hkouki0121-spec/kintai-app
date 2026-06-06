import type { SupabaseClient } from "@supabase/supabase-js";
import {
  analyzeAttendanceRecordForPayroll,
  type AttendancePayrollAnalysis,
} from "@/lib/payroll/analyze-attendance";
import {
  fetchAttendanceRecordsInScope,
  fetchEmployeeAttendanceInMonth,
} from "@/lib/payroll/attendance-query";
import { calculateEmployeePayroll } from "@/lib/payroll/calculate";
import { getPayrollSettings, normalizePayrollRoundingMinutes } from "@/lib/payroll/settings";
import type { EmployeePayrollLog } from "@/lib/payroll/sync-from-attendance";
import { isAllStores } from "@/lib/stores/queries";

export type PayrollDiagnosticItem = {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  closedRecords: number;
  openRecords: number;
  calculatedTotalHours: number;
  payrollTotalHours: number;
  totalPay: number;
  issues: string[];
  excludedRecords: AttendancePayrollAnalysis[];
};

export type PayrollDiagnostics = {
  year: number;
  month: number;
  roundingMinutes: number;
  items: PayrollDiagnosticItem[];
  employeeResults: EmployeePayrollLog[];
  excludedRecords: AttendancePayrollAnalysis[];
  summary: {
    employeesWithAttendance: number;
    employeesWithOpenShifts: number;
    employeesWithZeroPayroll: number;
    totalOpenShifts: number;
    totalExcludedRecords: number;
    attendanceRecordsTotal: number;
    attendanceIncluded: number;
    attendanceExcluded: number;
    exclusionReasons: Record<string, number>;
  };
};

async function resolveRoundingMinutes(
  supabase: SupabaseClient,
  companyId?: string | null,
  companyIds?: string[]
): Promise<number> {
  if (companyId) {
    const { data, error } = await supabase
      .from("companies")
      .select("payroll_rounding_minutes")
      .eq("id", companyId)
      .maybeSingle();
    if (error) return 30;
    return normalizePayrollRoundingMinutes(data?.payroll_rounding_minutes);
  }
  if (companyIds?.length === 1) {
    const { data, error } = await supabase
      .from("companies")
      .select("payroll_rounding_minutes")
      .eq("id", companyIds[0])
      .maybeSingle();
    if (error) return 30;
    return normalizePayrollRoundingMinutes(data?.payroll_rounding_minutes);
  }
  return 30;
}

export async function getPayrollDiagnostics(
  supabase: SupabaseClient,
  year: number,
  month: number,
  storeId?: string | null,
  companyId?: string | null
): Promise<PayrollDiagnostics> {
  const records = await fetchAttendanceRecordsInScope(supabase, year, month, storeId, companyId);
  const employeeIds = [...new Set(records.map((row) => row.employee_id))];

  let employeeQuery = supabase
    .from("employees")
    .select("id, name, employee_code, hourly_rate, company_id, store_id, is_active");

  if (companyId) {
    employeeQuery = employeeQuery.eq("company_id", companyId);
  }

  const { data: companyEmployees } = await employeeQuery;
  const scopedEmployeeIds = new Set(employeeIds);
  for (const emp of companyEmployees ?? []) {
    if (!isAllStores(storeId) && emp.store_id !== storeId) continue;
    if (emp.is_active) scopedEmployeeIds.add(emp.id);
  }

  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, employee_code, hourly_rate, company_id, store_id, is_active")
    .in("id", [...scopedEmployeeIds]);

  const employeeMap = new Map((employees ?? []).map((emp) => [emp.id, emp]));
  const companyIds = [...new Set((employees ?? []).map((emp) => emp.company_id))];
  const roundingMinutes = await resolveRoundingMinutes(supabase, companyId, companyIds);
  const settings = getPayrollSettings(roundingMinutes);

  const allAnalyses: AttendancePayrollAnalysis[] = records.map((record) =>
    analyzeAttendanceRecordForPayroll(
      record,
      employeeMap.get(record.employee_id) ?? null,
      year,
      month,
      settings.roundingMinutes
    )
  );

  const excludedRecords = allAnalyses.filter((item) => !item.included);
  const exclusionReasons = excludedRecords.reduce<Record<string, number>>((acc, item) => {
    if (!item.reason) return acc;
    const key = item.reason.split("（")[0];
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const { data: payrollRows } = await supabase
    .from("monthly_payroll")
    .select("employee_id, calculated_at, total_pay, regular_hours, night_hours")
    .eq("year", year)
    .eq("month", month)
    .in("employee_id", [...scopedEmployeeIds]);

  const payrollMap = new Map((payrollRows ?? []).map((row) => [row.employee_id, row]));
  const items: PayrollDiagnosticItem[] = [];
  const employeeResults: EmployeePayrollLog[] = [];

  const employeesWithAttendance = new Set(records.map((row) => row.employee_id));

  for (const empId of employeesWithAttendance) {
    const emp = employeeMap.get(empId);
    if (!emp) continue;

    const empRecords = records.filter((row) => row.employee_id === empId);
    const empAnalyses = allAnalyses.filter((item) => item.employeeId === empId);
    const openRecords = empRecords.filter((row) => !row.clock_out).length;
    const closedRecords = empRecords.length - openRecords;
    const empExcluded = empAnalyses.filter((item) => !item.included);

    const allEmpRecords = await fetchEmployeeAttendanceInMonth(supabase, emp.id, year, month);
    const result = calculateEmployeePayroll(
      emp.id,
      Number(emp.hourly_rate),
      allEmpRecords,
      year,
      month,
      settings
    );

    const payrollTotalHours = result.regularHours + result.nightHours;
    const savedPayroll = payrollMap.get(emp.id);
    const issues: string[] = [];

    if (!savedPayroll && closedRecords > 0) {
      issues.push("monthly_payroll が未作成です（給与を計算してください）");
    }
    if (savedPayroll && closedRecords > 0) {
      const latestClockOut = empRecords
        .map((row) => row.clock_out)
        .filter(Boolean)
        .sort()
        .at(-1);
      if (
        latestClockOut &&
        savedPayroll.calculated_at &&
        new Date(savedPayroll.calculated_at) < new Date(latestClockOut)
      ) {
        issues.push("給与データが勤怠より古いです（再計算が必要です）");
      }
    }
    if (openRecords > 0) {
      issues.push(`退勤未打刻が${openRecords}件あります`);
    }
    for (const excluded of empExcluded) {
      if (excluded.reason) {
        issues.push(`${excluded.clockIn.slice(0, 16)}: ${excluded.reason}`);
      }
    }

    const log: EmployeePayrollLog = {
      employee_name: emp.name,
      employee_id: emp.id,
      attendance_count: empRecords.length,
      included_count: empAnalyses.filter((item) => item.included).length,
      excluded_count: empExcluded.length,
      excluded_reason: empExcluded
        .filter((item) => item.reason)
        .map((item) => `${item.clockIn.slice(0, 16)}: ${item.reason}`),
      regular_hours: result.regularHours,
      night_hours: result.nightHours,
      payroll_hours: payrollTotalHours,
      total_pay: savedPayroll ? Number(savedPayroll.total_pay) : result.totalPay,
      upsert_ok: Boolean(savedPayroll),
    };
    employeeResults.push(log);

    if (issues.length > 0) {
      items.push({
        employeeId: emp.id,
        employeeName: emp.name,
        employeeCode: emp.employee_code,
        closedRecords,
        openRecords,
        calculatedTotalHours: result.actualTotalHours,
        payrollTotalHours,
        totalPay: log.total_pay,
        issues,
        excludedRecords: empExcluded,
      });
    }
  }

  employeeResults.sort((a, b) => a.employee_name.localeCompare(b.employee_name, "ja"));

  return {
    year,
    month,
    roundingMinutes,
    items,
    employeeResults,
    excludedRecords,
    summary: {
      employeesWithAttendance: employeesWithAttendance.size,
      employeesWithOpenShifts: items.filter((item) => item.openRecords > 0).length,
      employeesWithZeroPayroll: employeeResults.filter(
        (item) => item.included_count > 0 && item.payroll_hours === 0
      ).length,
      totalOpenShifts: records.filter((row) => !row.clock_out).length,
      totalExcludedRecords: excludedRecords.length,
      attendanceRecordsTotal: records.length,
      attendanceIncluded: allAnalyses.filter((item) => item.included).length,
      attendanceExcluded: excludedRecords.length,
      exclusionReasons,
    },
  };
}
