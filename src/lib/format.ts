import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";

export function formatJstDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return formatInTimeZone(d, TIMEZONE, "yyyy/MM/dd HH:mm");
}

export function formatJstDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return formatInTimeZone(d, TIMEZONE, "yyyy/MM/dd");
}

export function formatYen(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatHours(hours: number): string {
  return `${hours.toFixed(2)}時間`;
}

/** 実勤務時間表示（例: 0.97時間） */
export function formatActualHours(hours: number): string {
  return `${hours.toFixed(2)}時間`;
}

/** 給与計算時間表示（30分切り捨て後・例: 0.50時間） */
export function formatPayrollHours(hours: number): string {
  return `${hours.toFixed(2)}時間`;
}

/** 時間を H:MM 形式で表示（例: 176.5 → "176:30"） */
export function formatHoursClock(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
