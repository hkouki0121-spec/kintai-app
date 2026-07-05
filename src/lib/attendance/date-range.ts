import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** 当月の日付範囲（JST・YYYY-MM-DD） */
export function getCurrentMonthDateRangeInJst(date: Date = new Date()): {
  from: string;
  to: string;
} {
  const year = Number(formatInTimeZone(date, TIMEZONE, "yyyy"));
  const month = Number(formatInTimeZone(date, TIMEZONE, "M"));
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}
