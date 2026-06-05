export const BACKUP_BUCKET = "backups";

export const BACKUP_RETENTION_DAYS = 30;

export const BACKUP_TABLES = [
  "attendance_records",
  "attendance_corrections",
  "employees",
  "stores",
  "companies",
  "company_members",
  "monthly_payroll",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export function getBackupStoragePath(
  companyId: string,
  backupDate: string,
  table: BackupTable
): string {
  return `${companyId}/${backupDate}/${table}.csv`;
}
