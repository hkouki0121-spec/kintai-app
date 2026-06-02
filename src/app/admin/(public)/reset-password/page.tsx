"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    const initRecoverySession = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (exchangeError) {
          setError(
            "リンクが無効または期限切れです。再度パスワード再設定を申請してください。"
          );
          setInitializing(false);
          return;
        }
        setReady(true);
        setInitializing(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (session) {
        setReady(true);
        setInitializing(false);
        return;
      }

      setInitializing(false);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
        setInitializing(false);
      }
    });

    void initRecoverySession();

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("パスワードは8文字以上にしてください");
      return;
    }
    if (password !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError("パスワードの更新に失敗しました。リンクの有効期限を確認してください。");
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    setSuccess(true);
    setLoading(false);
    setTimeout(() => router.push("/admin/login"), 2000);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-bold text-slate-900">新しいパスワードの設定</h1>
        <p className="mt-1 text-sm text-slate-600">
          新しいパスワードを入力してください（8文字以上）
        </p>

        {initializing && (
          <p className="mt-6 text-sm text-slate-500">リンクを確認中…</p>
        )}

        {success && (
          <div className="mt-6 space-y-4">
            <Alert type="success">
              パスワードを更新しました。ログイン画面へ移動します…
            </Alert>
            <Link
              href="/admin/login"
              className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              ログイン画面へ
            </Link>
          </div>
        )}

        {!initializing && !success && !ready && (
          <div className="mt-6 space-y-4">
            <Alert type="error">
              {error ??
                "再設定リンクが無効です。パスワード再設定を再度お試しください。"}
            </Alert>
            <Link
              href="/admin/forgot-password"
              className="inline-flex w-full items-center justify-center rounded-xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-300"
            >
              パスワード再設定を申請
            </Link>
          </div>
        )}

        {!initializing && !success && ready && (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                新しいパスワード
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                新しいパスワード（確認）
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            {error && <Alert type="error">{error}</Alert>}
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? "更新中…" : "パスワードを更新"}
            </Button>
          </form>
        )}

        {!success && (
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
