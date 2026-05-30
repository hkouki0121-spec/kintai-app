/**
 * 勤務時間を30分単位で切り捨て（0.5時間刻み）
 * roundedHours = Math.floor(totalMinutes / 30) * 0.5
 */
export function roundMinutesToHalfHours(totalMinutes: number): number {
  if (totalMinutes <= 0) return 0;
  return Math.floor(totalMinutes / 30) * 0.5;
}
