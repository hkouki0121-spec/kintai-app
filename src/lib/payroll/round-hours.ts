import { MIN_WORK_MINUTES } from "@/lib/constants";

/**
 * 15分未満は給与対象外（0分として扱う）
 */
export function minutesEligibleForPayroll(totalMinutes: number): number {
  if (totalMinutes < MIN_WORK_MINUTES) return 0;
  return totalMinutes;
}

/**
 * 勤務時間を30分単位で切り捨て（0.5時間刻み）
 * 15分未満は0時間、以降は Math.floor(totalMinutes / 30) * 0.5
 */
export function roundMinutesToHalfHours(totalMinutes: number): number {
  const eligible = minutesEligibleForPayroll(totalMinutes);
  if (eligible <= 0) return 0;
  return Math.floor(eligible / 30) * 0.5;
}

/** 1勤務区間が給与計算対象か（合計15分未満は誤打刻・短時間として除外） */
export function isWorkSegmentEligible(regularMinutes: number, nightMinutes: number): boolean {
  return regularMinutes + nightMinutes >= MIN_WORK_MINUTES;
}
