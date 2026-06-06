import type { PayrollRoundingMinutes } from "@/lib/payroll/settings";
import { DEFAULT_PAYROLL_ROUNDING_MINUTES } from "@/lib/payroll/settings";

/** 給与計算対象外とする最短勤務（15分未満のみ除外） */
export const MIN_PAYROLL_WORK_MINUTES = 15;

/**
 * 勤務分を区切り単位で切り捨て（例: 30分単位なら 44分 → 30分）
 * 1勤務ごとに適用し、合計は各勤務の切り捨て結果の足し算
 */
export function roundMinutesForPayroll(
  totalMinutes: number,
  roundingMinutes: PayrollRoundingMinutes = DEFAULT_PAYROLL_ROUNDING_MINUTES
): number {
  if (totalMinutes < roundingMinutes) return 0;
  return Math.floor(totalMinutes / roundingMinutes) * roundingMinutes;
}

/** 切り捨て後の勤務時間（時間） */
export function roundMinutesToPayrollHours(
  totalMinutes: number,
  roundingMinutes: PayrollRoundingMinutes = DEFAULT_PAYROLL_ROUNDING_MINUTES
): number {
  return roundMinutesForPayroll(totalMinutes, roundingMinutes) / 60;
}

/** 1勤務区間が給与計算対象か（退勤済みかつ15分以上） */
export function isWorkSegmentEligible(
  regularMinutes: number,
  nightMinutes: number
): boolean {
  return regularMinutes + nightMinutes >= MIN_PAYROLL_WORK_MINUTES;
}

/** @deprecated roundMinutesToPayrollHours を使用 */
export function roundMinutesToHalfHours(totalMinutes: number): number {
  return roundMinutesToPayrollHours(totalMinutes, 30);
}
