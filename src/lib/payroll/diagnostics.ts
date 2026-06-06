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
import type { PayrollScope } from "@/lib/payroll/resolve-scope";
import type { EmployeePayrollLog } from "@/lib/payroll/sync-from-attendance";

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
  queryMeta: {
    dateFrom: string;
    dateTo: string;
    filterDescription: string;
    dataCompanyIds: string[];
    accessibleStoreIds: string[];
  };
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

export async function getPayrollDiagnostics(
  readSupabase: SupabaseClient,
  writeSupabase: SupabaseClient,
  year: number,
  month: number,
  scope: PayrollScope
): Promise<PayrollDiagnostics> {
  const attendanceResult = await fetchAttendanceRecordsInScope(
    readSupabase,
    year,
    month,
    scope,
    "rls"
  );
  const records = attendanceResult.records;
  const employeeIds = [...new Set(records.map((row) => row.employee_id))];

  const { data: employees } = await readSupabase
    .from("employees")
    .select("id, name, employee_code, hourly_rate, company_id, store_id, is_active")
    .in("id", employeeIds.length > 0 ? employeeIds : ["00000000-0000-0000-0000-000000000000"]);

  const employeeMap = new Map((employees ?? []).map((emp) => [emp.id, emp]));
  const dataCompanyIds =
    scope.dataCompanyIds.length > 0
      ? scope.dataCompanyIds
      : [...new Set(records.map((row) => row.company_id))];

  const roundingMinutes = normalizePayrollRoundingMinutes(
    dataCompanyIds.length === 1
      ? (
          await writeSupabase
            .from("companies")
            .select("payroll_rounding_minutes")
            .eq("id", dataCompanyIds[0])
            .maybeSingle()
        ).data?.payroll_rounding_minutes
      : 30
  );
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

  const { data: payrollRows } = await writeSupabase
    .from("monthly_payroll")
    .select("employee_id, calculated_at, total_pay, regular_hours, night_hours")
    .eq("year", year)
    .eq("month", month)
    .in("employee_id", employeeIds.length > 0 ? employeeIds : ["00000000-0000-0000-0000-000000000000"]);

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

    const allEmpRecords = await fetchEmployeeAttendanceInMonth(readSupabase, emp.id, year, month);
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
    queryMeta: {
      dateFrom: attendanceResult.meta.dateFrom,
      dateTo: attendanceResult.meta.dateTo,
      filterDescription: attendanceResult.meta.filterDescription,
      dataCompanyIds: scope.dataCompanyIds,
      accessibleStoreIds: scope.accessibleStoreIds,
    },
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
