import { splitWorkMinutes } from "@/lib/payroll/calculate";
import { getPayrollMonthRange } from "@/lib/payroll/month-range";
import {
  isWorkSegmentEligible,
  MIN_PAYROLL_WORK_MINUTES,
  roundMinutesForPayroll,
} from "@/lib/payroll/round-hours";
import type { PayrollRoundingMinutes } from "@/lib/payroll/settings";

export type AttendanceRecordForAnalysis = {
  id: string;
  employee_id: string;
  store_id: string;
  company_id: string;
  clock_in: string;
  clock_out: string | null;
};

export type EmployeeForAnalysis = {
  id: string;
  company_id: string;
  store_id?: string;
  name?: string;
  employee_code?: string;
};

export type AttendancePayrollAnalysis = {
  recordId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  clockIn: string;
  clockOut: string | null;
  included: boolean;
  reason: string | null;
  workMinutes: number;
  payrollMinutes: number;
};

export function analyzeAttendanceRecordForPayroll(
  record: AttendanceRecordForAnalysis,
  employee: EmployeeForAnalysis | null,
  year: number,
  month: number,
  roundingMinutes: PayrollRoundingMinutes
): AttendancePayrollAnalysis {
  const base = {
    recordId: record.id,
    employeeId: record.employee_id,
    employeeName: employee?.name ?? "不明",
    employeeCode: employee?.employee_code ?? "—",
    clockIn: record.clock_in,
    clockOut: record.clock_out,
    included: false,
    reason: null as string | null,
    workMinutes: 0,
    payrollMinutes: 0,
  };

  if (!employee) {
    return { ...base, reason: "employee_id 不一致" };
  }
  if (record.employee_id !== employee.id) {
    return { ...base, reason: "employee_id 不一致" };
  }
  if (record.company_id !== employee.company_id) {
    return { ...base, reason: "company_id 不一致" };
  }
  if (!record.clock_out) {
    return { ...base, reason: "退勤未打刻" };
  }

  const { dateFrom, dateTo } = getPayrollMonthRange(year, month);
  const clockIn = new Date(record.clock_in);
  const clockOut = new Date(record.clock_out);

  if (record.clock_in < dateFrom || record.clock_in >= dateTo) {
    return { ...base, reason: "対象月外" };
  }

  const segment = splitWorkMinutes(clockIn, clockOut);
  const workMinutes = segment.regularMinutes + segment.nightMinutes;
  base.workMinutes = workMinutes;

  if (!isWorkSegmentEligible(segment.regularMinutes, segment.nightMinutes)) {
    return {
      ...base,
      reason: `勤務時間が${MIN_PAYROLL_WORK_MINUTES}分未満（${workMinutes}分）`,
    };
  }

  const payrollMinutes =
    roundMinutesForPayroll(segment.regularMinutes, roundingMinutes) +
    roundMinutesForPayroll(segment.nightMinutes, roundingMinutes);
  base.payrollMinutes = payrollMinutes;

  return { ...base, included: true };
}

export function summarizeExclusionReasons(
  analyses: AttendancePayrollAnalysis[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of analyses) {
    if (item.included || !item.reason) continue;
    const key = item.reason.split("（")[0];
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
