import type { SupabaseClient } from "@supabase/supabase-js";
import { BACKUP_BUCKET, BACKUP_RETENTION_DAYS } from "@/lib/backup/constants";
import { isBackupExpired } from "@/lib/backup/backup-date";

export type CleanupResult = {
  deletedDates: string[];
  deletedFiles: number;
  errors: string[];
};

/** 30日を超えた古いバックアップを Storage と backup_runs から削除 */
export async function cleanupOldBackups(
  supabase: SupabaseClient,
  companyId?: string
): Promise<CleanupResult> {
  const result: CleanupResult = {
    deletedDates: [],
    deletedFiles: 0,
    errors: [],
  };

  let query = supabase
    .from("backup_runs")
    .select("company_id, backup_date")
    .order("backup_date", { ascending: true });

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data: runs, error } = await query;
  if (error) {
    result.errors.push(error.message);
    return result;
  }

  const expired = (runs ?? []).filter((run) =>
    isBackupExpired(String(run.backup_date), BACKUP_RETENTION_DAYS)
  );

  for (const run of expired) {
    const date = String(run.backup_date);
    const prefix = `${run.company_id}/${date}`;

    const { data: objects, error: listError } = await supabase.storage
      .from(BACKUP_BUCKET)
      .list(`${run.company_id}/${date}`);

    if (listError) {
      result.errors.push(`一覧取得失敗 (${prefix}): ${listError.message}`);
      continue;
    }

    const paths = (objects ?? []).map((obj) => `${prefix}/${obj.name}`);
    if (paths.length > 0) {
      const { error: removeError } = await supabase.storage.from(BACKUP_BUCKET).remove(paths);
      if (removeError) {
        result.errors.push(`Storage 削除失敗 (${prefix}): ${removeError.message}`);
        continue;
      }
      result.deletedFiles += paths.length;
    }

    const { error: deleteRunError } = await supabase
      .from("backup_runs")
      .delete()
      .eq("company_id", run.company_id)
      .eq("backup_date", date);

    if (deleteRunError) {
      result.errors.push(`backup_runs 削除失敗 (${run.company_id}/${date}): ${deleteRunError.message}`);
      continue;
    }

    result.deletedDates.push(`${run.company_id}/${date}`);
  }

  return result;
}
