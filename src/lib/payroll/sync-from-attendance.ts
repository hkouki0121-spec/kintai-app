import type { SupabaseClient } from "@supabase/supabase-js";
import {
  analyzeAttendanceRecordForPayroll,
  summarizeExclusionReasons,
  type AttendancePayrollAnalysis,
} from "@/lib/payroll/analyze-attendance";
import { collectPayrollTargetEmployeeIds } from "@/lib/payroll/collect-targets";
import { getJstMonthBounds } from "@/lib/payroll/jst-month";
import { recalculateEmployeeMonthlyPayroll } from "@/lib/payroll/recalculate-employee";
import { getPayrollSettings, normalizePayrollRoundingMinutes } from "@/lib/payroll/settings";
import { isAllStores } from "@/lib/stores/queries";

export type PayrollSyncResult = {
  processed: number;
  errors: string[];
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
  const { data } = await supabase
    .from("companies")
    .select("payroll_rounding_minutes")
    .eq("id", companyId)
    .maybeSingle();
  return normalizePayrollRoundingMinutes(data?.payroll_rounding_minutes);
}

async function analyzeAttendanceInScope(
  supabase: SupabaseClient,
  year: number,
  month: number,
  storeId?: string | null,
  companyId?: string | null
): Promise<AttendancePayrollAnalysis[]> {
  const { start: monthStart, end: monthEnd } = getJstMonthBounds(year, month);
  const roundingMinutes = normalizePayrollRoundingMinutes(
    await resolveRoundingMinutes(supabase, companyId)
  );
  const settings = getPayrollSettings(roundingMinutes);

  let attendanceQuery = supabase
    .from("attendance_records")
    .select("id, employee_id, store_id, company_id, clock_in, clock_out")
    .lt("clock_in", monthEnd.toISOString())
    .or(`clock_out.gt.${monthStart.toISOString()},clock_out.is.null`);

  if (companyId) {
    attendanceQuery = attendanceQuery.eq("company_id", companyId);
  }
  if (!isAllStores(storeId)) {
    attendanceQuery = attendanceQuery.eq("store_id", storeId!);
  }

  const { data: records, error } = await attendanceQuery;
  if (error) throw error;
  if (!records?.length) return [];

  const employeeIds = [...new Set(records.map((row) => row.employee_id))];
  const { data: employees } = await supabase
    .from("employees")
    .select("id, company_id, store_id, name, employee_code")
    .in("id", employeeIds);

  const employeeMap = new Map((employees ?? []).map((emp) => [emp.id, emp]));

  return records.map((record) =>
    analyzeAttendanceRecordForPayroll(
      record,
      employeeMap.get(record.employee_id) ?? null,
      year,
      month,
      settings.roundingMinutes
    )
  );
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
  const analyses = await analyzeAttendanceInScope(supabase, year, month, storeId, companyId);
  const attendanceIncluded = analyses.filter((item) => item.included).length;
  const attendanceExcluded = analyses.length - attendanceIncluded;
  const exclusionReasons = summarizeExclusionReasons(analyses);

  const targetEmployeeIds = await collectPayrollTargetEmployeeIds(
    supabase,
    year,
    month,
    storeId,
    companyId
  );

  const errors: string[] = [];
  let processed = 0;

  for (const employeeId of targetEmployeeIds) {
    const result = await recalculateEmployeeMonthlyPayroll(supabase, employeeId, year, month);
    if (!result.ok) {
      errors.push(`${employeeId}: ${result.error}`);
    } else {
      processed += 1;
    }
  }

  const excludedSamples = analyses
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
    attendanceRecordsTotal: analyses.length,
    attendanceIncluded,
    attendanceExcluded,
    exclusionReasons,
    targetEmployeeCount: targetEmployeeIds.length,
  };

  console.log("[payroll/calculate]", {
    対象年月: `${year}年${month}月`,
    対象店舗: storeLabel,
    取得したattendance_records件数: analyses.length,
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

  return { processed, errors, stats, excludedSamples };
}
