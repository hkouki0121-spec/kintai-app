"use client";

import { useMemo, useState } from "react";
import type { BackupRun, Company } from "@/types/database";
import { useAdminCompany } from "@/components/admin/AdminCompanyProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

type Props = {
  initialBackups: BackupRun[];
  companies: Pick<Company, "id" | "name">[];
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

export function BackupManager({ initialBackups, companies }: Props) {
  const { companyId, isSuperAdmin } = useAdminCompany();
  const [backups, setBackups] = useState(initialBackups);
  const [selectedCompanyId, setSelectedCompanyId] = useState(
    companyId ?? companies[0]?.id ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const companyNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const company of companies) {
      map.set(company.id, company.name);
    }
    return map;
  }, [companies]);

  const loadBackups = async (targetCompanyId?: string) => {
    const params = new URLSearchParams();
    if (isSuperAdmin && targetCompanyId) {
      params.set("companyId", targetCompanyId);
    }

    const response = await fetch(`/api/admin/backups?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "バックアップ一覧の取得に失敗しました");
    }
    setBackups(data.backups ?? []);
  };

  const handleRefresh = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await loadBackups(isSuperAdmin ? selectedCompanyId : undefined);
      setMessage({ type: "success", text: "一覧を更新しました。" });
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const body: { companyId?: string } = {};
      if (isSuperAdmin) {
        if (!selectedCompanyId) {
          throw new Error("会社を選択してください");
        }
        body.companyId = selectedCompanyId;
      }

      const response = await fetch("/api/admin/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "バックアップ作成に失敗しました");
      }

      await loadBackups(isSuperAdmin ? selectedCompanyId : undefined);
      setMessage({ type: "success", text: "バックアップを作成しました。" });
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (companyIdForFile: string, backupDate: string, fileName: string) => {
    const path = `${companyIdForFile}/${backupDate}/${fileName}`;
    setDownloadingPath(path);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/backups/download?path=${encodeURIComponent(path)}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "ダウンロードに失敗しました");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message });
    } finally {
      setDownloadingPath(null);
    }
  };

  const handleCompanyChange = async (nextCompanyId: string) => {
    setSelectedCompanyId(nextCompanyId);
    setLoading(true);
    setMessage(null);
    try {
      await loadBackups(nextCompanyId);
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          {isSuperAdmin && (
            <div>
              <label className="mb-1 block text-sm text-slate-600">会社</label>
              <select
                value={selectedCompanyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Button type="button" onClick={handleCreateBackup} disabled={loading}>
            {loading ? "処理中…" : "手動バックアップ作成"}
          </Button>
          <Button type="button" variant="secondary" onClick={handleRefresh} disabled={loading}>
            一覧を更新
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          毎日深夜3時（JST）に自動バックアップされます。CSV は Supabase Storage の backups
          バケットに会社ごとに保存され、30日間保持されます。バックアップファイルは管理画面から削除できません。
        </p>
      </Card>

      {message && <Alert type={message.type}>{message.text}</Alert>}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              {isSuperAdmin && <th className="px-4 py-3 font-medium">会社</th>}
              <th className="px-4 py-3 font-medium">バックアップ日</th>
              <th className="px-4 py-3 font-medium">状態</th>
              <th className="px-4 py-3 font-medium">作成日時</th>
              <th className="px-4 py-3 font-medium">ファイル</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {backups.map((backup) => {
              const files = Array.isArray(backup.files) ? (backup.files as string[]) : [];
              return (
                <tr key={backup.id}>
                  {isSuperAdmin && (
                    <td className="px-4 py-3 text-slate-600">
                      {companyNameById.get(backup.company_id) ?? backup.company_id}
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium">{backup.backup_date}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        backup.status === "success"
                          ? "text-emerald-700"
                          : "text-red-600"
                      }
                    >
                      {backup.status === "success" ? "成功" : "失敗"}
                    </span>
                    {backup.error_message && (
                      <p className="mt-1 text-xs text-red-500">{backup.error_message}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(backup.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {files.map((fileName) => {
                        const path = `${backup.company_id}/${backup.backup_date}/${fileName}`;
                        return (
                          <Button
                            key={path}
                            type="button"
                            variant="secondary"
                            className="py-1 text-xs"
                            disabled={downloadingPath === path}
                            onClick={() =>
                              handleDownload(backup.company_id, backup.backup_date, fileName)
                            }
                          >
                            {downloadingPath === path ? "取得中…" : fileName}
                          </Button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {backups.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">
            バックアップがありません。「手動バックアップ作成」で初回バックアップを作成できます。
          </p>
        )}
      </div>
    </div>
  );
}
