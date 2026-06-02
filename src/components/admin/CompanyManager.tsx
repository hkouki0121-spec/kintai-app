"use client";

import { useEffect, useState } from "react";
import type { Company } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { formatJstDateTime } from "@/lib/format";

export function CompanyManager() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminName, setAdminName] = useState("");

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/companies");
      const data = (await res.json()) as { companies?: Company[]; error?: string };
      if (res.ok) {
        setCompanies(data.companies ?? []);
      } else {
        setMessage(data.error ?? "会社一覧の取得に失敗しました");
      }
    } catch {
      setMessage("会社一覧の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCompanies();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          adminEmail: adminEmail || undefined,
          adminPassword: adminPassword || undefined,
          adminName: adminName || undefined,
        }),
      });

      const data = (await res.json()) as { error?: string; adminCreated?: boolean };
      if (!res.ok) {
        setMessage(data.error ?? "会社作成に失敗しました");
        return;
      }

      setName("");
      setAdminEmail("");
      setAdminPassword("");
      setAdminName("");
      setMessage(
        data.adminCreated
          ? "会社と管理者アカウントを作成しました"
          : "会社を作成しました"
      );
      await loadCompanies();
    } catch {
      setMessage("会社作成に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <Alert type={message.includes("失敗") ? "error" : "success"}>{message}</Alert>
      )}

      <Card>
        <h3 className="font-semibold text-slate-900">新規会社</h3>
        <form onSubmit={handleCreate} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-slate-600">会社名</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">管理者メール（任意）</label>
            <Input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">管理者名（任意）</label>
            <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-slate-600">管理者パスワード（任意・8文字以上）</label>
            <Input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              minLength={8}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "作成中…" : "会社を作成"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h3 className="font-semibold text-slate-900">登録会社一覧</h3>
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">読み込み中…</p>
        ) : companies.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">会社が登録されていません</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {companies.map((company) => (
              <li key={company.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-slate-900">
                    {company.name}
                    {!company.is_active && (
                      <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                        無効
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    登録: {formatJstDateTime(company.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
