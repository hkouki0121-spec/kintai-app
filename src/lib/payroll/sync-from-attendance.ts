import type { SupabaseClient } from "@supabase/supabase-js";
import {
  analyzeAttendanceRecordForPayroll,
  summarizeExclusionReasons,
  type AttendancePayrollAnalysis,
} from "@/lib/payroll/analyze-attendance";
import {
  fetchAttendanceRecordsInScope,
  fetchEmployeeAttendanceInMonth,
} from "@/lib/payroll/attendance-query";
import { calculateEmployeePayroll } from "@/lib/payroll/calculate";
import { collectPayrollTargetEmployeeIds } from "@/lib/payroll/collect-targets";
import { recalculateEmployeeMonthlyPayroll } from "@/lib/payroll/recalculate-employee";
import {
  getPayrollSettings,
  normalizePayrollRoundingMinutes,
  type PayrollRoundingMinutes,
} from "@/lib/payroll/settings";
import { isAllStores } from "@/lib/stores/queries";

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
  companyId?: string | null
): Promise<PayrollRoundingMinutes> {
  if (!companyId) return 30;
  const { data, error } = await supabase
    .from("companies")
    .select("payroll_rounding_minutes")
    .eq("id", companyId)
    .maybeSingle();
  if (error) return 30;
  return normalizePayrollRoundingMinutes(data?.payroll_rounding_minutes);
}

function analyzeRecords(
  records: Awaited<ReturnType<typeof fetchEmployeeAttendanceInMonth>>,
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
  supabase: SupabaseClient,
  year: number,
  month: number,
  storeId?: string | null,
  companyId?: string | null,
  storeLabel = "全店舗"
): Promise<PayrollSyncResult> {
  const roundingMinutes = await resolveRoundingMinutes(supabase, companyId);
  const settings = getPayrollSettings(roundingMinutes);

  const scopedAttendance = await fetchAttendanceRecordsInScope(
    supabase,
    year,
    month,
    storeId,
    companyId
  );

  const targetEmployeeIds = await collectPayrollTargetEmployeeIds(
    supabase,
    year,
    month,
    storeId,
    companyId
  );

  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, employee_code, hourly_rate, company_id, store_id, is_active")
    .in("id", targetEmployeeIds.length > 0 ? targetEmployeeIds : ["00000000-0000-0000-0000-000000000000"]);

  const employeeMap = new Map((employees ?? []).map((emp) => [emp.id, emp]));
  const errors: string[] = [];
  const employeeLogs: EmployeePayrollLog[] = [];
  const allAnalyses: AttendancePayrollAnalysis[] = [];
  let processed = 0;

  for (const employeeId of targetEmployeeIds) {
    const employee = employeeMap.get(employeeId);
    const allRecords = await fetchEmployeeAttendanceInMonth(supabase, employeeId, year, month);
    const displayRecords = isAllStores(storeId)
      ? allRecords
      : allRecords.filter((record) => record.store_id === storeId);

    const analyses = analyzeRecords(
      displayRecords,
      employee,
      year,
      month,
      settings.roundingMinutes
    );
    allAnalyses.push(...analyses);

    const payrollPreview = calculateEmployeePayroll(
      employeeId,
      Number(employee?.hourly_rate ?? 0),
      allRecords,
      year,
      month,
      settings
    );

    const result = await recalculateEmployeeMonthlyPayroll(supabase, employeeId, year, month);
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

  const stats = {
    companyId: companyId ?? null,
    storeId: isAllStores(storeId) ? null : (storeId ?? null),
    storeLabel,
    year,
    month,
    attendanceRecordsTotal: scopedAttendance.length,
    attendanceIncluded,
    attendanceExcluded,
    exclusionReasons,
    targetEmployeeCount: targetEmployeeIds.length,
  };

  console.log("[payroll/calculate]", {
    companyId: stats.companyId,
    storeId: stats.storeId,
    year,
    month,
    attendance_records_count: stats.attendanceRecordsTotal,
    included_count: attendanceIncluded,
    excluded_count: attendanceExcluded,
    employee_results: employeeLogs,
    excluded_records: excludedRecords.map((item) => ({
      employee_name: item.employeeName,
      employee_id: item.employeeId,
      clock_in: item.clockIn,
      reason: item.reason,
    })),
  });

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
