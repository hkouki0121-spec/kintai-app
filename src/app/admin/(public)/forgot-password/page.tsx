"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { FORGOT_PASSWORD_SUCCESS_MESSAGE } from "@/lib/auth/forgot-password-messages";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        code?: string | null;
        sent?: boolean;
      };

      console.log("[forgot-password] API response", {
        status: res.status,
        ok: data.ok,
        sent: data.sent,
        error: data.error ?? null,
        code: data.code ?? null,
      });

      if (!res.ok || data.ok === false) {
        setErrorMessage(data.error ?? "メール送信に失敗しました。");
        setSubmitted(false);
        return;
      }

      setSuccessMessage(data.message ?? FORGOT_PASSWORD_SUCCESS_MESSAGE);
      setSubmitted(true);
    } catch (fetchError) {
      console.error("[forgot-password] fetch error", fetchError);
      setErrorMessage("通信エラーが発生しました。時間をおいて再度お試しください。");
      setSubmitted(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-bold text-slate-900">パスワード再設定</h1>
        <p className="mt-1 text-sm text-slate-600">
          登録済みのメールアドレスを入力してください。再設定用のリンクをお送りします。
        </p>

        {submitted && successMessage ? (
          <div className="mt-6 space-y-4">
            <Alert type="success">{successMessage}</Alert>
            <p className="text-sm text-slate-600">
              メールが届かない場合は、迷惑メールフォルダをご確認ください。
              Supabase 無料枠では時間あたりの送信数に制限があります。本番運用では
              Supabase Dashboard → Authentication → SMTP Settings でカスタム SMTP
              の設定を推奨します。
            </p>
            <Link
              href="/admin/login"
              className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              ログイン画面へ戻る
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                メールアドレス
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            {errorMessage && <Alert type="error">{errorMessage}</Alert>}
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? "送信中…" : "再設定メールを送信"}
            </Button>
          </form>
        )}

        {!submitted && (
          <p className="mt-4 text-center text-sm">
            <Link href="/admin/login" className="text-blue-600 hover:underline">
              ログイン画面へ戻る
            </Link>
          </p>
        )}
      </Card>
    </main>
  );
}
