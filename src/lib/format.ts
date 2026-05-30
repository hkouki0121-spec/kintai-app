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
