"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";

type LoginEmailAccount = {
  userId: string;
  email: string | null;
  name: string | null;
  role: string;
  companyId: string | null;
  companyName: string | null;
};

function roleLabel(role: string): string {
  if (role === "super_admin") return "スーパー管理者";
  if (role === "company_admin") return "会社管理者";
  return role;
}

export function AccountLoginEmails() {
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<LoginEmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/account/login-emails");
        const data = (await res.json()) as {
          currentUserEmail?: string | null;
          accounts?: LoginEmailAccount[];
          error?: string;
        };

        if (!res.ok) {
          if (!cancelled) setError(data.error ?? "読み込みに失敗しました");
          return;
        }

        if (!cancelled) {
          setCurrentUserEmail(data.currentUserEmail ?? null);
          setAccounts(data.accounts ?? []);
        }
      } catch {
        if (!cancelled) setError("読み込みに失敗しました");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      {error && <Alert type="error">{error}</Alert>}

      <Card>
        <h3 className="font-semibold text-slate-900">現在ログイン中のアカウント</h3>
        <p className="mt-2 text-sm text-slate-600">
          {loading ? "読み込み中…" : currentUserEmail ?? "—"}
        </p>
      </Card>

      <Card>
        <h3 className="font-semibold text-slate-900">ログインメール一覧</h3>
        <p className="mt-1 text-sm text-slate-600">
          パスワードを忘れた場合は、こちらのメールアドレスで再設定できます。
        </p>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">読み込み中…</p>
        ) : accounts.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">登録されている管理者がありません</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">メールアドレス</th>
                  <th className="px-4 py-3 font-medium">名前</th>
                  <th className="px-4 py-3 font-medium">権限</th>
                  <th className="px-4 py-3 font-medium">会社</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map((account) => (
                  <tr key={account.userId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{account.email ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{account.name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{roleLabel(account.role)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {account.companyName ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-semibold text-slate-900">パスワードを忘れた場合</h3>
        <p className="mt-2 text-sm text-slate-600">
          上記のログインメールアドレスを使って、
          <a href="/admin/forgot-password" className="text-blue-600 hover:underline">
            パスワード再設定
          </a>
          から新しいパスワードを設定してください。
        </p>
      </Card>
    </div>
  );
}
