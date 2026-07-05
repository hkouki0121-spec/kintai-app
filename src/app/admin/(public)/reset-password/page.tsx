"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  clearStoredRecoverySession,
  establishRecoverySession,
  restoreStoredRecoverySession,
} from "@/lib/auth/recovery-session";
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
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let cancelled = false;

    const { data: authListener } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (cancelled) return;
      console.log("[reset-password] onAuthStateChange", {
        event,
        hasSession: !!session,
        userId: session?.user?.id ?? null,
      });
      if (event === "PASSWORD_RECOVERY" && session) {
        setReady(true);
        setInitializing(false);
        setError(null);
      }
    });

    const initRecoverySession = async () => {
      const result = await establishRecoverySession(supabase);
      if (cancelled) return;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      console.log("[reset-password] init", {
        establishOk: result.ok,
        hasSession: !!session,
        sessionUserId: session?.user?.id ?? null,
        getUserId: user?.id ?? null,
        getUserError: userError?.message ?? null,
      });

      if (result.ok && session && user) {
        setReady(true);
        setError(null);
      } else {
        setError(result.ok ? "セッションの確立に失敗しました。" : result.error);
      }

      setInitializing(false);
    };

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

    await restoreStoredRecoverySession(supabase);

    const {
      data: { session: sessionBefore },
    } = await supabase.auth.getSession();
    console.log("[reset-password] getSession(before update)", {
      hasSession: !!sessionBefore,
      userId: sessionBefore?.user?.id ?? null,
      expiresAt: sessionBefore?.expires_at ?? null,
    });

    const {
      data: { user: userBefore },
      error: userBeforeError,
    } = await supabase.auth.getUser();
    console.log("[reset-password] getUser(before update)", {
      userId: userBefore?.id ?? null,
      error: userBeforeError?.message ?? null,
    });

    if (userBeforeError || !userBefore) {
      setError(
        userBeforeError?.message ??
          "セッションが無効です。パスワード再設定を最初からやり直してください。"
      );
      setLoading(false);
      return;
    }

    const { error: refreshError } = await supabase.auth.refreshSession();
    console.log("[reset-password] refreshSession", {
      error: refreshError?.message ?? null,
    });

    try {
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });

      const data = (await res.json()) as { error?: string; ok?: boolean };
      console.log("[reset-password] update-password API", {
        status: res.status,
        error: data.error ?? null,
      });

      if (!res.ok) {
        if (res.status === 401) {
          await restoreStoredRecoverySession(supabase);
          await supabase.auth.refreshSession();
          const { error: clientUpdateError } = await supabase.auth.updateUser({ password });
          console.log("[reset-password] client updateUser fallback", {
            error: clientUpdateError?.message ?? null,
            status: clientUpdateError?.status ?? null,
          });
          if (!clientUpdateError) {
            clearStoredRecoverySession();
            await supabase.auth.signOut();
            setSuccess(true);
            setLoading(false);
            setTimeout(() => router.push("/admin/login"), 2000);
            return;
          }
          setError(clientUpdateError.message);
        } else {
          setError(data.error ?? "パスワードの更新に失敗しました。");
        }
        setLoading(false);
        return;
      }

      clearStoredRecoverySession();
      await supabase.auth.signOut();
      setSuccess(true);
      setLoading(false);
      setTimeout(() => router.push("/admin/login"), 2000);
    } catch (fetchError) {
      console.error("[reset-password] fetch error", fetchError);
      setError("パスワードの更新に失敗しました。通信環境を確認してください。");
      setLoading(false);
    }
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
