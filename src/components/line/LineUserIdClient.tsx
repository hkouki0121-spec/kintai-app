"use client";

import { useCallback, useEffect, useState } from "react";
import liff from "@line/liff";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import Link from "next/link";

type Status = "loading" | "ready" | "error";

export function LineUserIdClient() {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  const [status, setStatus] = useState<Status>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!liffId) {
      setStatus("error");
      setErrorMessage("NEXT_PUBLIC_LIFF_ID が設定されていません。Vercel の環境変数を確認してください。");
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        await liff.init({ liffId });

        if (cancelled) return;

        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        const profile = await liff.getProfile();
        if (cancelled) return;

        setUserId(profile.userId);
        setDisplayName(profile.displayName);
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "LINE の初期化に失敗しました。"
        );
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [liffId]);

  const handleCopy = useCallback(async () => {
    if (!userId) return;

    try {
      await navigator.clipboard.writeText(userId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMessage("クリップボードへのコピーに失敗しました。手動で選択してコピーしてください。");
    }
  }, [userId]);

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col gap-4 p-4 pb-8 sm:p-6">
      <header className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">LINEユーザーID取得</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          表示された ID を店舗管理画面の「LINEユーザーID」欄に貼り付けてください。
        </p>
      </header>

      <Card>
        {status === "loading" && (
          <p className="text-center text-sm text-slate-600">LINE 情報を取得しています…</p>
        )}

        {status === "error" && errorMessage && <Alert type="error">{errorMessage}</Alert>}

        {status === "ready" && userId && (
          <div className="space-y-4">
            {displayName && (
              <p className="text-sm text-slate-600">
                ログイン中：<span className="font-medium text-slate-900">{displayName}</span>
              </p>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                あなたの LINEユーザーID
              </label>
              <div className="break-all rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-900">
                {userId}
              </div>
            </div>

            <Button fullWidth onClick={handleCopy}>
              {copied ? "コピーしました" : "IDをコピー"}
            </Button>

            <Alert type="info">
              店舗管理 → 店舗編集 → LINEユーザーID に貼り付け、「LINE通知を有効にする」にチェックを入れてください。
            </Alert>
          </div>
        )}
      </Card>

      <div className="text-center">
        <Link href="/" className="text-sm text-slate-500 underline-offset-2 hover:text-blue-600 hover:underline">
          打刻画面へ戻る
        </Link>
      </div>
    </main>
  );
}
