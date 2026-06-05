import type { SupabaseClient } from "@supabase/supabase-js";
import { getBackupDateInJst } from "@/lib/backup/backup-date";
import { cleanupOldBackups } from "@/lib/backup/cleanup-old-backups";
import { runCompanyBackup } from "@/lib/backup/run-company-backup";

export type DailyBackupResult = {
  backupDate: string;
  companies: number;
  succeeded: number;
  failed: number;
  cleanup: Awaited<ReturnType<typeof cleanupOldBackups>>;
  errors: string[];
};

/** 全アクティブ会社の日次バックアップ + 古いバックアップ削除 */
export async function executeDailyBackup(
  supabase: SupabaseClient,
  backupDate = getBackupDateInJst()
): Promise<DailyBackupResult> {
  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("id")
    .eq("is_active", true);

  if (companiesError) {
    throw new Error(companiesError.message);
  }

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const company of companies ?? []) {
    const result = await runCompanyBackup(supabase, company.id, backupDate);
    if (result.status === "success") {
      succeeded += 1;
    } else {
      failed += 1;
      errors.push(`${company.id}: ${result.errorMessage ?? "unknown error"}`);
    }
  }

  const cleanup = await cleanupOldBackups(supabase);

  return {
    backupDate,
    companies: companies?.length ?? 0,
    succeeded,
    failed,
    cleanup,
    errors,
  };
}
