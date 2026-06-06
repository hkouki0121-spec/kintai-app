import { addMinutes, endOfMonth } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import {
  DAILY_STATUTORY_MINUTES,
  NIGHT_RATE_MULTIPLIER,
  TIMEZONE,
} from "@/lib/constants";
import { floorYen } from "@/lib/payroll/floor-yen";
import { getJstMonthBounds } from "@/lib/payroll/jst-month";
import {
  isWorkSegmentEligible,
  roundMinutesForPayroll,
} from "@/lib/payroll/round-hours";
import {
  getPayrollSettings,
  type PayrollSettings,
} from "@/lib/payroll/settings";

export type WorkSegment = {
  regularMinutes: number;
  nightMinutes: number;
};

function getJstDateKey(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd");
}

function isDateInMonth(dayKey: string, year: number, month: number): boolean {
  const [y, m] = dayKey.split("-").map(Number);
  return y === year && m === month;
}

/** 1勤務区間を通常・深夜（22時〜翌5時）に分割（分単位・JST） */
export function splitWorkMinutes(clockIn: Date, clockOut: Date): WorkSegment {
  let regularMinutes = 0;
  let nightMinutes = 0;
  let cursor = new Date(clockIn);

  while (cursor < clockOut) {
    const jst = toZonedTime(cursor, TIMEZONE);
    const hour = jst.getHours();
    const isNight = hour >= 22 || hour < 5;
    if (isNight) nightMinutes += 1;
    else regularMinutes += 1;
    cursor = addMinutes(cursor, 1);
  }

  return { regularMinutes, nightMinutes };
}

/** 1勤務区間をJST日付ごとに分割 */
export function splitWorkMinutesByDay(clockIn: Date, clockOut: Date): Map<string, WorkSegment> {
  const byDay = new Map<string, WorkSegment>();
  let cursor = new Date(clockIn);

  while (cursor < clockOut) {
    const key = getJstDateKey(cursor);
    const jst = toZonedTime(cursor, TIMEZONE);
    const hour = jst.getHours();
    const isNight = hour >= 22 || hour < 5;
    const entry = byDay.get(key) ?? { regularMinutes: 0, nightMinutes: 0 };
    if (isNight) entry.nightMinutes += 1;
    else entry.regularMinutes += 1;
    byDay.set(key, entry);
    cursor = addMinutes(cursor, 1);
  }

  return byDay;
}

export type PayrollResult = {
  employeeId: string;
  year: number;
  month: number;
  attendanceDays: number;
  actualRegularHours: number;
  actualNightHours: number;
  actualTotalHours: number;
  overtimeHours: number;
  regularHours: number;
  nightHours: number;
  regularPay: number;
  nightPay: number;
  totalPay: number;
};

export function calculateEmployeePayroll(
  employeeId: string,
  hourlyRate: number,
  records: { clock_in: string; clock_out: string | null }[],
  year: number,
  month: number,
  settings: PayrollSettings = getPayrollSettings()
): PayrollResult {
  const { start: monthStart, end: monthEnd } = getJstMonthBounds(year, month);
  const roundingMinutes = settings.roundingMinutes;

  let actualRegularMinutes = 0;
  let actualNightMinutes = 0;
  let payrollRegularMinutes = 0;
  let payrollNightMinutes = 0;
  const attendanceDayKeys = new Set<string>();
  const dailyTotalMinutes = new Map<string, number>();

  for (const record of records) {
    if (!record.clock_out) continue;
    const clockIn = new Date(record.clock_in);
    const clockOut = new Date(record.clock_out);
    if (clockOut <= monthStart || clockIn > monthEnd) continue;

    const effectiveIn = clockIn < monthStart ? monthStart : clockIn;
    const effectiveOut = clockOut > monthEnd ? monthEnd : clockOut;
    if (effectiveOut <= effectiveIn) continue;

    const segment = splitWorkMinutes(effectiveIn, effectiveOut);
    if (!isWorkSegmentEligible(segment.regularMinutes, segment.nightMinutes)) {
      continue;
    }

    actualRegularMinutes += segment.regularMinutes;
    actualNightMinutes += segment.nightMinutes;
    payrollRegularMinutes += roundMinutesForPayroll(segment.regularMinutes, roundingMinutes);
    payrollNightMinutes += roundMinutesForPayroll(segment.nightMinutes, roundingMinutes);

    for (const [dayKey, daySegment] of splitWorkMinutesByDay(effectiveIn, effectiveOut)) {
      if (!isDateInMonth(dayKey, year, month)) continue;
      const dayTotal = daySegment.regularMinutes + daySegment.nightMinutes;
      if (dayTotal <= 0) continue;
      attendanceDayKeys.add(dayKey);
      dailyTotalMinutes.set(dayKey, (dailyTotalMinutes.get(dayKey) ?? 0) + dayTotal);
    }
  }

  let overtimeMinutes = 0;
  for (const dayTotal of dailyTotalMinutes.values()) {
    overtimeMinutes += Math.max(0, dayTotal - DAILY_STATUTORY_MINUTES);
  }

  const actualRegularHours = minutesToHours(actualRegularMinutes);
  const actualNightHours = minutesToHours(actualNightMinutes);
  const actualTotalHours = minutesToHours(actualRegularMinutes + actualNightMinutes);
  const overtimeHours = minutesToHours(overtimeMinutes);
  const regularHours = minutesToHours(payrollRegularMinutes);
  const nightHours = minutesToHours(payrollNightMinutes);
  const regularPay = floorYen(regularHours * hourlyRate);
  const nightPay = floorYen(nightHours * hourlyRate * NIGHT_RATE_MULTIPLIER);
  const totalPay = floorYen(regularPay + nightPay);

  return {
    employeeId,
    year,
    month,
    attendanceDays: attendanceDayKeys.size,
    actualRegularHours,
    actualNightHours,
    actualTotalHours,
    overtimeHours,
    regularHours,
    nightHours,
    regularPay,
    nightPay,
    totalPay,
  };
}

function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/** 月末判定（JST） */
export function isLastDayOfMonthInJst(date: Date = new Date()): boolean {
  const zoned = toZonedTime(date, TIMEZONE);
  const end = endOfMonth(zoned);
  return formatInTimeZone(zoned, TIMEZONE, "yyyy-MM-dd") === formatInTimeZone(end, TIMEZONE, "yyyy-MM-dd");
}

/** 当月の year/month（JST） */
export function getCurrentMonthInJst(date: Date = new Date()): { year: number; month: number } {
  const zoned = toZonedTime(date, TIMEZONE);
  return {
    year: zoned.getFullYear(),
    month: zoned.getMonth() + 1,
  };
}
