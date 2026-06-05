import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BACKUP_BUCKET,
  BACKUP_TABLES,
  getBackupStoragePath,
  type BackupTable,
} from "@/lib/backup/constants";
import { recordsToCsv } from "@/lib/backup/csv";
import { notifyBackupFailure } from "@/lib/backup/notify-failure";

const PAGE_SIZE = 1000;

type CompanyBackupResult = {
  companyId: string;
  backupDate: string;
  status: "success" | "failed";
  files: string[];
  errorMessage?: string;
};

async function fetchCompanyRows(
  supabase: SupabaseClient,
  table: BackupTable,
  companyId: string
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    let query = supabase.from(table).select("*");

    if (table === "companies") {
      query = query.eq("id", companyId);
    } else {
      query = query.eq("company_id", companyId);
    }

    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`${table} の取得に失敗: ${error.message}`);
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    all.push(...rows);

    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

async function uploadBackupFile(
  supabase: SupabaseClient,
  storagePath: string,
  csv: string
): Promise<void> {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const { error } = await supabase.storage.from(BACKUP_BUCKET).upload(storagePath, blob, {
    contentType: "text/csv;charset=utf-8",
    upsert: true,
  });

  if (error) {
    throw new Error(`Storage アップロード失敗 (${storagePath}): ${error.message}`);
  }
}

async function recordBackupRun(
  supabase: SupabaseClient,
  result: CompanyBackupResult
): Promise<void> {
  const { error } = await supabase.from("backup_runs").upsert(
    {
      company_id: result.companyId,
      backup_date: result.backupDate,
      status: result.status,
      files: result.files,
      error_message: result.errorMessage ?? null,
    },
    { onConflict: "company_id,backup_date" }
  );

  if (error) {
    throw new Error(`backup_runs 記録失敗: ${error.message}`);
  }
}

/** 1社分のバックアップを実行 */
export async function runCompanyBackup(
  supabase: SupabaseClient,
  companyId: string,
  backupDate: string
): Promise<CompanyBackupResult> {
  const uploadedFiles: string[] = [];

  try {
    for (const table of BACKUP_TABLES) {
      const rows = await fetchCompanyRows(supabase, table, companyId);
      const csv = recordsToCsv(rows);
      const storagePath = getBackupStoragePath(companyId, backupDate, table);
      await uploadBackupFile(supabase, storagePath, csv);
      uploadedFiles.push(`${table}.csv`);
    }

    const result: CompanyBackupResult = {
      companyId,
      backupDate,
      status: "success",
      files: uploadedFiles,
    };

    await recordBackupRun(supabase, result);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const result: CompanyBackupResult = {
      companyId,
      backupDate,
      status: "failed",
      files: uploadedFiles,
      errorMessage,
    };

    try {
      await recordBackupRun(supabase, result);
    } catch (recordError) {
      console.error("[backup] backup_runs 記録失敗", recordError);
    }

    try {
      await notifyBackupFailure(supabase, companyId, backupDate, errorMessage);
    } catch (notifyError) {
      console.error("[backup] LINE 通知失敗", notifyError);
    }

    return result;
  }
}

export type { CompanyBackupResult };
