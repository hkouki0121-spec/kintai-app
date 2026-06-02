"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { CompanyContextDiagnostics } from "@/lib/auth/company-context";

export default function NoAccessPage() {
  const [diagnostics, setDiagnostics] =
    useState<CompanyContextDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/company-context")
      .then((res) => res.json())
      .then((data: CompanyContextDiagnostics) => setDiagnostics(data))
      .catch((error) => {
        console.error("[no-access] diagnostics fetch failed", error);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-2xl">
        <h1 className="text-xl font-bold text-slate-900">アクセス権限がありません</h1>
        <p className="mt-2 text-sm text-slate-600">
          このアカウントは会社に紐付けられていません。管理者にお問い合わせください。
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Link href="/admin/register" className="text-blue-600 hover:underline">
            会社アカウントを新規登録
          </Link>
          <Link href="/admin/login" className="text-sm text-slate-500 hover:underline">
            別のアカウントでログイン
          </Link>
        </div>

        <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
          <p className="font-semibold">company-context 診断ログ</p>
          {loading && <p className="mt-2 text-slate-500">読み込み中…</p>}
          {!loading && diagnostics && (
            <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all">
              {JSON.stringify(diagnostics, null, 2)}
            </pre>
          )}
        </div>
      </Card>
    </main>
  );
}
