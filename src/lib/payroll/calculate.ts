import { addMinutes, endOfMonth, startOfMonth
 } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { NIGHT_RATE_MULTIPLIER, TIMEZONE } from "@/lib/constants";

export type WorkSegment = {
  regularMinutes: number;
  nightMinutes: number;
};

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

export type PayrollResult = {
  employeeId: string;
  year: number;
  month: number;
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
  month: number
): PayrollResult {
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);

  let regularMinutes = 0;
  let nightMinutes = 0;

  for (const record of records) {
    if (!record.clock_out) continue;
    const clockIn = new Date(record.clock_in);
    const clockOut = new Date(record.clock_out);
    if (clockOut <= monthStart || clockIn > monthEnd) continue;

    const effectiveIn = clockIn < monthStart ? monthStart : clockIn;
    const effectiveOut = clockOut > monthEnd ? monthEnd : clockOut;
    if (effectiveOut <= effectiveIn) continue;

    const segment = splitWorkMinutes(effectiveIn, effectiveOut);
    regularMinutes += segment.regularMinutes;
    nightMinutes += segment.nightMinutes;
  }

  const regularHours = roundHours(regularMinutes / 60);
  const nightHours = roundHours(nightMinutes / 60);
  const regularPay = roundYen(regularHours * hourlyRate);
  const nightPay = roundYen(nightHours * hourlyRate * NIGHT_RATE_MULTIPLIER);
  const totalPay = roundYen(regularPay + nightPay);

  return {
    employeeId,
    year,
    month,
    regularHours,
    nightHours,
    regularPay,
    nightPay,
    totalPay,
  };
}

function roundHours(h: number): number {
  return Math.round(h * 10000) / 10000;
}

function roundYen(y: number): number {
  return Math.round(y);
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
