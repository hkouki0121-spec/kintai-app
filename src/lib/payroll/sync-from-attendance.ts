import type { SupabaseClient } from "@supabase/supabase-js";
import {
  analyzeAttendanceRecordForPayroll,
  summarizeExclusionReasons,
  type AttendancePayrollAnalysis,
} from "@/lib/payroll/analyze-attendance";
import { calculateEmployeePayroll } from "@/lib/payroll/calculate";
import { collectPayrollTargetEmployeeIds } from "@/lib/payroll/collect-targets";
import { getJstMonthBounds } from "@/lib/payroll/jst-month";
import { recalculateEmployeeMonthlyPayroll } from "@/lib/payroll/recalculate-employee";
import { getPayrollSettings, normalizePayrollRoundingMinutes } from "@/lib/payroll/settings";
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
    year: number;
    month: number;
    storeId: string | null;
    storeLabel: string;
    attendanceRecordsTotal: number;
    attendanceIncluded: number;
    attendanceExcluded: number;
    exclusionReasons: Record<string, number>;
    targetEmployeeCount: number;
  };
  excludedSamples: string[];
};

async function resolveRoundingMinutes(
  supabase: SupabaseClient,
  companyId?: string | null
): Promise<number> {
  if (!companyId) return 30;
  const { data, error } = await supabase
    .from("companies")
    .select("payroll_rounding_minutes")
    .eq("id", companyId)
    .maybeSingle();
  if (error) return 30;
  return normalizePayrollRoundingMinutes(data?.payroll_rounding_minutes);
}

async function fetchEmployeeAttendanceInMonth(
  supabase: SupabaseClient,
  employeeId: string,
  year: number,
  month: number
) {
  const { start: monthStart, end: monthEnd } = getJstMonthBounds(year, month);
  const { data, error } = await supabase
    .from("attendance_records")
    .select("id, employee_id, store_id, company_id, clock_in, clock_out")
    .eq("employee_id", employeeId)
    .lt("clock_in", monthEnd.toISOString())
    .or(`clock_out.gt.${monthStart.toISOString()},clock_out.is.null`);
  if (error) throw error;
  return data ?? [];
}

function logEmployeePayrollResult(log: EmployeePayrollLog) {
  console.log("[payroll/calculate]", log);
}

/** 表示中の月について、勤怠から給与を再計算 */
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
  let processed = 0;
  let attendanceRecordsTotal = 0;
  let attendanceIncluded = 0;
  let attendanceExcluded = 0;
  const allAnalyses: AttendancePayrollAnalysis[] = [];

  for (const employeeId of targetEmployeeIds) {
    const employee = employeeMap.get(employeeId);
    const records = await fetchEmployeeAttendanceInMonth(supabase, employeeId, year, month);
    const analyses = records.map((record) =>
      analyzeAttendanceRecordForPayroll(
        record,
        employee ?? null,
        year,
        month,
        settings.roundingMinutes
      )
    );

    allAnalyses.push(...analyses);
    attendanceRecordsTotal += analyses.length;
    attendanceIncluded += analyses.filter((item) => item.included).length;
    attendanceExcluded += analyses.filter((item) => !item.included).length;

    const payrollPreview = calculateEmployeePayroll(
      employeeId,
      Number(employee?.hourly_rate ?? 0),
      records,
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
      attendance_count: records.length,
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
    logEmployeePayrollResult(log);
    employeeLogs.push(log);

    if (!result.ok) {
      errors.push(`${employee?.name ?? employeeId}: ${result.error}`);
    } else {
      processed += 1;
    }
  }

  const exclusionReasons = summarizeExclusionReasons(allAnalyses);
  const excludedSamples = allAnalyses
    .filter((item) => !item.included && item.reason)
    .slice(0, 20)
    .map(
      (item) =>
        `${item.employeeName}（${item.employeeCode}）${item.clockIn.slice(0, 16)}: ${item.reason}`
    );

  const stats = {
    year,
    month,
    storeId: isAllStores(storeId) ? null : (storeId ?? null),
    storeLabel,
    attendanceRecordsTotal,
    attendanceIncluded,
    attendanceExcluded,
    exclusionReasons,
    targetEmployeeCount: targetEmployeeIds.length,
  };

  console.log("[payroll/calculate]", {
    対象年月: `${year}年${month}月`,
    対象店舗: storeLabel,
    取得したattendance_records件数: attendanceRecordsTotal,
    給与計算対象になった件数: attendanceIncluded,
    除外された件数: attendanceExcluded,
    除外理由: exclusionReasons,
    対象従業員数: targetEmployeeIds.length,
    再計算成功: processed,
    再計算エラー: errors.length,
  });

  if (excludedSamples.length > 0) {
    console.log("[payroll/calculate] 除外サンプル", excludedSamples);
  }
  if (errors.length > 0) {
    console.log("[payroll/calculate] エラー", errors);
  }

  return { processed, errors, employeeLogs, stats, excludedSamples };
}
