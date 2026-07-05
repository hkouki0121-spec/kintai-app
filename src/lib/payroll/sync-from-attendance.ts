import type { SupabaseClient } from "@supabase/supabase-js";
import {
  analyzeAttendanceRecordForPayroll,
  summarizeExclusionReasons,
  type AttendancePayrollAnalysis,
} from "@/lib/payroll/analyze-attendance";
import {
  fetchAttendanceRecordsInScope,
  fetchEmployeesAttendanceInMonth,
  type AttendanceRecordRow,
} from "@/lib/payroll/attendance-query";
import { calculateEmployeePayroll } from "@/lib/payroll/calculate";
import { collectPayrollTargetEmployeeIds } from "@/lib/payroll/collect-targets";
import { getPayrollMonthRange } from "@/lib/payroll/month-range";
import type { PayrollScope } from "@/lib/payroll/resolve-scope";
import { recalculateEmployeeMonthlyPayroll } from "@/lib/payroll/recalculate-employee";
import {
  getPayrollSettings,
  normalizePayrollRoundingMinutes,
  type PayrollRoundingMinutes,
} from "@/lib/payroll/settings";

export type EmployeePayrollLog = {
  employee_name: string;
  employee_id: string;
  attendance_count: number;
  included_count: number;
  excluded_count: number;
  excluded_reason: string[];
  regular_hours: number;
  night_hours: number;
  payroll_hours: number;
  total_pay: number;
  upsert_ok: boolean;
  error?: string;
};

export type PayrollSyncResult = {
  processed: number;
  errors: string[];
  employeeLogs: EmployeePayrollLog[];
  stats: {
    companyId: string | null;
    storeId: string | null;
    storeLabel: string;
    year: number;
    month: number;
    attendanceRecordsTotal: number;
    attendanceIncluded: number;
    attendanceExcluded: number;
    exclusionReasons: Record<string, number>;
    targetEmployeeCount: number;
  };
  excludedRecords: AttendancePayrollAnalysis[];
  excludedSamples: string[];
};

async function resolveRoundingMinutes(
  supabase: SupabaseClient,
  dataCompanyIds: string[],
  attendanceRecords: { company_id: string }[]
): Promise<PayrollRoundingMinutes> {
  const companyIds =
    dataCompanyIds.length > 0
      ? dataCompanyIds
      : [...new Set(attendanceRecords.map((row) => row.company_id))];

  if (companyIds.length === 1) {
    const { data, error } = await supabase
      .from("companies")
      .select("payroll_rounding_minutes")
      .eq("id", companyIds[0])
      .maybeSingle();
    if (!error) return normalizePayrollRoundingMinutes(data?.payroll_rounding_minutes);
  }
  return 30;
}

function analyzeRecords(
  records: AttendanceRecordRow[],
  employee: { id: string; company_id: string; name?: string; employee_code?: string } | undefined,
  year: number,
  month: number,
  roundingMinutes: PayrollRoundingMinutes
): AttendancePayrollAnalysis[] {
  return records.map((record) =>
    analyzeAttendanceRecordForPayroll(
      record,
      employee
        ? {
            id: employee.id,
            company_id: employee.company_id,
            name: employee.name,
            employee_code: employee.employee_code,
          }
        : null,
      year,
      month,
      roundingMinutes
    )
  );
}

/** 表示中の月について、勤怠から給与を再計算して monthly_payroll を上書き */
export async function syncPayrollFromAttendance(
  readSupabase: SupabaseClient,
  writeSupabase: SupabaseClient,
  year: number,
  month: number,
  scope: PayrollScope,
  storeLabel = "全店舗",
  readMode: "rls" | "service" = "rls"
): Promise<PayrollSyncResult> {
  const range = getPayrollMonthRange(year, month);
  const attendanceResult = await fetchAttendanceRecordsInScope(
    readSupabase,
    year,
    month,
    scope,
    readMode
  );
  const scopedAttendance = attendanceResult.records;

  const roundingMinutes = await resolveRoundingMinutes(
    writeSupabase,
    scope.dataCompanyIds,
    scopedAttendance
  );
  const settings = getPayrollSettings(roundingMinutes);

  const targetEmployeeIds = await collectPayrollTargetEmployeeIds(
    readSupabase,
    year,
    month,
    scope,
    readMode,
    { attendanceRecords: scopedAttendance }
  );

  const allAttendanceByEmployee = await fetchEmployeesAttendanceInMonth(
    readSupabase,
    targetEmployeeIds,
    year,
    month
  );

  const { data: employees } = await writeSupabase
    .from("employees")
    .select("id, name, employee_code, hourly_rate, company_id, store_id, is_active")
    .in("id", targetEmployeeIds.length > 0 ? targetEmployeeIds : ["00000000-0000-0000-0000-000000000000"]);

  const employeeMap = new Map((employees ?? []).map((emp) => [emp.id, emp]));
  const errors: string[] = [];
  const employeeLogs: EmployeePayrollLog[] = [];
  const allAnalyses: AttendancePayrollAnalysis[] = [];
  let processed = 0;

  const recordsByEmployee = new Map<string, typeof scopedAttendance>();
  for (const record of scopedAttendance) {
    const list = recordsByEmployee.get(record.employee_id) ?? [];
    list.push(record);
    recordsByEmployee.set(record.employee_id, list);
  }

  for (const employeeId of targetEmployeeIds) {
    const employee = employeeMap.get(employeeId);
    const allRecords = allAttendanceByEmployee.get(employeeId) ?? [];
    const displayRecords = recordsByEmployee.get(employeeId) ?? [];

    const analyses = analyzeRecords(displayRecords, employee, year, month, settings.roundingMinutes);
    allAnalyses.push(...analyses);

    const payrollPreview = calculateEmployeePayroll(
      employeeId,
      Number(employee?.hourly_rate ?? 0),
      allRecords,
      year,
      month,
      settings
    );

    console.log("[payroll/calculate/shifts]", {
      employee_name: employee?.name ?? "不明",
      employee_id: employeeId,
      hourly_rate: Number(employee?.hourly_rate ?? 0),
      shifts: payrollPreview.shifts.map((shift) => ({
        clock_in: shift.clockIn,
        clock_out: shift.clockOut,
        actual_regular_minutes: shift.actualRegularMinutes,
        actual_night_minutes: shift.actualNightMinutes,
        payroll_regular_minutes: shift.payrollRegularMinutes,
        payroll_night_minutes: shift.payrollNightMinutes,
        regular_pay: shift.regularPay,
        night_pay: shift.nightPay,
        shift_total_pay: shift.shiftTotalPay,
      })),
      totals: {
        regular_hours: payrollPreview.regularHours,
        night_hours: payrollPreview.nightHours,
        regular_pay: payrollPreview.regularPay,
        night_pay: payrollPreview.nightPay,
        total_pay: payrollPreview.totalPay,
      },
    });

    const result = await recalculateEmployeeMonthlyPayroll(writeSupabase, employeeId, year, month);
    const excludedReasons = analyses
      .filter((item) => !item.included && item.reason)
      .map((item) => `${item.clockIn.slice(0, 16)}: ${item.reason}`);

    const log: EmployeePayrollLog = {
      employee_name: employee?.name ?? "不明",
      employee_id: employeeId,
      attendance_count: displayRecords.length,
      included_count: analyses.filter((item) => item.included).length,
      excluded_count: analyses.filter((item) => !item.included).length,
      excluded_reason: excludedReasons,
      regular_hours: payrollPreview.regularHours,
      night_hours: payrollPreview.nightHours,
      payroll_hours: payrollPreview.regularHours + payrollPreview.nightHours,
      total_pay: payrollPreview.totalPay,
      upsert_ok: result.ok,
      error: result.ok ? undefined : result.error,
    };

    console.log("[payroll/calculate]", log);
    employeeLogs.push(log);

    if (!result.ok) {
      errors.push(`${employee?.name ?? employeeId}: ${result.error}`);
    } else {
      processed += 1;
    }
  }

  const attendanceIncluded = allAnalyses.filter((item) => item.included).length;
  const attendanceExcluded = allAnalyses.length - attendanceIncluded;
  const exclusionReasons = summarizeExclusionReasons(allAnalyses);
  const excludedRecords = allAnalyses.filter((item) => !item.included);

  console.log("[payroll/calculate]", {
    adminUserId: scope.adminUserId,
    adminCompanyId: scope.adminCompanyId,
    storeId: scope.storeId,
    year,
    month,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    attendanceQuery: attendanceResult.meta.filterDescription,
    attendance_records_count: scopedAttendance.length,
    attendance_records_sample: scopedAttendance.slice(0, 5).map((row) => ({
      id: row.id,
      employee_id: row.employee_id,
      store_id: row.store_id,
      company_id: row.company_id,
      clock_in: row.clock_in,
      clock_out: row.clock_out,
    })),
    included_count: attendanceIncluded,
    excluded_count: attendanceExcluded,
    employee_results: employeeLogs,
    excluded_records: excludedRecords.map((item) => ({
      employee_name: item.employeeName,
      employee_id: item.employeeId,
      clock_in: item.clockIn,
      reason: item.reason,
    })),
    "error.message": attendanceResult.error?.message ?? null,
    "error.code": attendanceResult.error?.code ?? null,
    "error.details": attendanceResult.error?.details ?? null,
  });

  const stats = {
    companyId: scope.adminCompanyId,
    storeId: scope.storeId,
    storeLabel,
    year,
    month,
    attendanceRecordsTotal: scopedAttendance.length,
    attendanceIncluded,
    attendanceExcluded,
    exclusionReasons,
    targetEmployeeCount: targetEmployeeIds.length,
  };

  const excludedSamples = excludedRecords
    .slice(0, 30)
    .map(
      (item) =>
        `${item.employeeName}（${item.employeeCode}）${item.clockIn.slice(0, 16)}: ${item.reason}`
    );

  return {
    processed,
    errors,
    employeeLogs,
    stats,
    excludedRecords,
    excludedSamples,
  };
}
