import { createClient } from "@/lib/supabase/server";
import { requireCompanyContext } from "@/lib/auth/company-context";
import { BackupManager } from "@/components/admin/BackupManager";
import type { BackupRun, Company } from "@/types/database";

export default async function BackupsPage() {
  const supabase = await createClient();
  const context = await requireCompanyContext(supabase);

  const [{ data: backups }, { data: companies }] = await Promise.all([
    supabase
      .from("backup_runs")
      .select("id, company_id, backup_date, status, files, error_message, created_at")
      .order("backup_date", { ascending: false })
      .limit(60),
    context.isSuperAdmin
      ? supabase.from("companies").select("id, name").eq("is_active", true).order("name")
      : context.companyId
        ? supabase.from("companies").select("id, name").eq("id", context.companyId)
        : Promise.resolve({ data: [] as Pick<Company, "id" | "name">[] }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">バックアップ</h2>
        <p className="text-sm text-slate-600">
          勤怠・給与データの CSV バックアップを確認・ダウンロードできます。毎日深夜3時（JST）に自動実行され、30日間保存されます。
        </p>
      </div>
      <BackupManager
        initialBackups={(backups as BackupRun[]) ?? []}
        companies={(companies as Pick<Company, "id" | "name">[]) ?? []}
      />
    </div>
  );
}
