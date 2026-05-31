import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";

export type AttendanceNotifyType = "clock_in" | "clock_out";

export function formatLineNotifyDateTime(iso: string): string {
  return formatInTimeZone(new Date(iso), TIMEZONE, "yyyy/M/d HH:mm");
}

export function buildAttendanceLineMessage(params: {
  type: AttendanceNotifyType;
  employeeName: string;
  storeName: string;
  timestamp: string;
}): string {
  const label = params.type === "clock_in" ? "出勤" : "退勤";
  const time = formatLineNotifyDateTime(params.timestamp);

  return `【${label}】\n${params.employeeName}さん\n店舗：${params.storeName}\n時刻：${time}`;
}
