import type { PayrollRoundingMinutes } from "@/lib/payroll/settings";
import { DEFAULT_PAYROLL_ROUNDING_MINUTES } from "@/lib/payroll/settings";

/** 給与計算対象の最短勤務（区切り単位と同じ） */
export function getMinWorkMinutes(roundingMinutes: PayrollRoundingMinutes): number {
  return roundingMinutes;
}

/**
 * 勤務分を会社設定の区切りで切り捨て（例: 30分単位なら 44分 → 30分）
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

/** 1勤務区間が給与計算対象か */
export function isWorkSegmentEligible(
  regularMinutes: number,
  nightMinutes: number,
  roundingMinutes: PayrollRoundingMinutes = DEFAULT_PAYROLL_ROUNDING_MINUTES
): boolean {
  return regularMinutes + nightMinutes >= getMinWorkMinutes(roundingMinutes);
}

/** @deprecated roundMinutesToPayrollHours を使用 */
export function roundMinutesToHalfHours(totalMinutes: number): number {
  return roundMinutesToPayrollHours(totalMinutes, 30);
}
