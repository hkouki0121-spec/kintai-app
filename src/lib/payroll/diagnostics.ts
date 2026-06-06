import type { SupabaseClient } from "@supabase/supabase-js";
import {
  analyzeAttendanceRecordForPayroll,
  type AttendancePayrollAnalysis,
} from "@/lib/payroll/analyze-attendance";
import { calculateEmployeePayroll } from "@/lib/payroll/calculate";
import { getJstMonthBounds } from "@/lib/payroll/jst-month";
import { getPayrollSettings, normalizePayrollRoundingMinutes } from "@/lib/payroll/settings";
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
  excludedRecords: AttendancePayrollAnalysis[];
};

export type PayrollDiagnostics = {
  year: number;
  month: number;
  roundingMinutes: number;
  items: PayrollDiagnosticItem[];
  excludedRecords: AttendancePayrollAnalysis[];
  summary: {
    employeesWithAttendance: number;
    employeesWithOpenShifts: number;
    employeesWithZeroPayroll: number;
    totalOpenShifts: number;
    totalExcludedRecords: number;
  };
};

async function resolveRoundingMinutes(
  supabase: SupabaseClient,
  companyId?: string | null,
  companyIds?: string[]
): Promise<number> {
  if (companyId) {
    const { data } = await supabase
      .from("companies")
      .select("payroll_rounding_minutes")
      .eq("id", companyId)
      .maybeSingle();
    return normalizePayrollRoundingMinutes(data?.payroll_rounding_minutes);
  }
  if (companyIds?.length === 1) {
    const { data } = await supabase
      .from("companies")
      .select("payroll_rounding_minutes")
      .eq("id", companyIds[0])
      .maybeSingle();
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
  const { start: monthStart, end: monthEnd } = getJstMonthBounds(year, month);

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

  const { data: attendanceRows } = await attendanceQuery;
  const records = attendanceRows ?? [];
  const employeeIds = [...new Set(records.map((row) => row.employee_id))];

  let employeeQuery = supabase
    .from("employees")
    .select("id, name, employee_code, hourly_rate, company_id, store_id, is_active")
    .eq("is_active", true);

  if (!isAllStores(storeId)) {
    employeeQuery = employeeQuery.eq("store_id", storeId!);
  }
  if (companyId) {
    employeeQuery = employeeQuery.eq("company_id", companyId);
  }

  const { data: scopedEmployees } = await employeeQuery;
  const scopedEmployeeIds = new Set((scopedEmployees ?? []).map((emp) => emp.id));
  for (const id of employeeIds) {
    scopedEmployeeIds.add(id);
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
  const items: PayrollDiagnosticItem[] = [];

  for (const emp of employees ?? []) {
    const empRecords = records.filter((row) => row.employee_id === emp.id);
    if (empRecords.length === 0) continue;

    const empAnalyses = allAnalyses.filter((item) => item.employeeId === emp.id);
    const openRecords = empRecords.filter((row) => !row.clock_out).length;
    const closedRecords = empRecords.length - openRecords;
    const empExcluded = empAnalyses.filter((item) => !item.included);

    const result = calculateEmployeePayroll(
      emp.id,
      Number(emp.hourly_rate),
      empRecords,
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
      issues.push(`勤怠はあるが給与計算時間が0です（${roundingMinutes}分単位未満の可能性）`);
    }
    for (const excluded of empExcluded) {
      if (excluded.reason) {
        issues.push(`${excluded.clockIn.slice(0, 16)}: ${excluded.reason}`);
      }
    }
    for (const record of empRecords) {
      const employee = employeeMap.get(record.employee_id);
      if (employee?.store_id && employee.store_id !== record.store_id) {
        issues.push(
          `${record.clock_in.slice(0, 16)}: store_id 不一致（所属店舗と勤怠店舗が異なります）`
        );
      }
    }

    if (issues.length === 0 && payrollTotalHours > 0) continue;

    items.push({
      employeeId: emp.id,
      employeeName: emp.name,
      employeeCode: emp.employee_code,
      closedRecords,
      openRecords,
      calculatedTotalHours: result.actualTotalHours,
      payrollTotalHours,
      issues,
      excludedRecords: empExcluded,
    });
  }

  return {
    year,
    month,
    roundingMinutes,
    items,
    excludedRecords,
    summary: {
      employeesWithAttendance: new Set(records.map((row) => row.employee_id)).size,
      employeesWithOpenShifts: items.filter((item) => item.openRecords > 0).length,
      employeesWithZeroPayroll: items.filter(
        (item) => item.closedRecords > 0 && item.payrollTotalHours === 0
      ).length,
      totalOpenShifts: records.filter((row) => !row.clock_out).length,
      totalExcludedRecords: excludedRecords.length,
    },
  };
}
