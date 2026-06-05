import { fromZonedTime } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** JST での月初・月末（UTC Date） */
export function getJstMonthBounds(year: number, month: number): { start: Date; end: Date } {
  const lastDay = new Date(year, month, 0).getDate();
  const start = fromZonedTime(`${year}-${pad(month)}-01T00:00:00`, TIMEZONE);
  const end = fromZonedTime(`${year}-${pad(month)}-${pad(lastDay)}T23:59:59`, TIMEZONE);
  return { start, end };
}
