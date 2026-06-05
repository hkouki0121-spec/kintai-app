import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";

/** バックアップ日付（JST・yyyy-MM-dd） */
export function getBackupDateInJst(date: Date = new Date()): string {
  return formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd");
}

/** 保持期限を過ぎた日付か（JST基準） */
export function isBackupExpired(backupDate: string, retentionDays: number): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffKey = getBackupDateInJst(cutoff);
  return backupDate < cutoffKey;
}
