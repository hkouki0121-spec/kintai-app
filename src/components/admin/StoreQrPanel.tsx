"use client";

import { useEffect, useState } from "react";
import type { Store } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

type Props = {
  store: Store;
  appBaseUrl: string;
};

type QrStatus = {
  hasToken: boolean;
  updatedAt: string | null;
};

type RegenerateResult = {
  qrUrl: string;
  updatedAt: string;
};

function buildQrImageUrl(qrUrl: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrUrl)}`;
}

export function StoreQrPanel({ store, appBaseUrl }: Props) {
  const [status, setStatus] = useState<QrStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [issuedQr, setIssuedQr] = useState<RegenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/stores/${store.id}/qr-token`);
      const data = (await res.json()) as QrStatus & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "QR状態の取得に失敗しました");
        return;
      }
      setStatus({ hasToken: data.hasToken, updatedAt: data.updatedAt });
    } catch {
      setError("QR状態の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, [store.id]);

  const handleRegenerate = async () => {
    const confirmed = window.confirm(
      "QRコードを再発行すると、以前のQRコードは無効になります。続行しますか？"
    );
    if (!confirmed) return;

    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/stores/${store.id}/qr-token`, { method: "POST" });
      const data = (await res.json()) as RegenerateResult & { error?: string; qrUrl?: string };
      if (!res.ok || !data.qrUrl) {
        setError(data.error ?? "QRコードの再発行に失敗しました");
        return;
      }

      setIssuedQr({ qrUrl: data.qrUrl, updatedAt: data.updatedAt });
      setStatus({ hasToken: true, updatedAt: data.updatedAt });
    } catch {
      setError("QRコードの再発行に失敗しました");
    } finally {
      setRegenerating(false);
    }
  };

  const displayQrUrl = issuedQr?.qrUrl;

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-slate-900">緊急打刻用QRコード</h4>
          <p className="mt-1 text-xs text-slate-500">
            顔認証失敗時の緊急打刻用です。店舗に掲示してください。
          </p>
          {loading ? (
            <p className="mt-2 text-sm text-slate-500">状態を確認中…</p>
          ) : status?.hasToken ? (
            <p className="mt-2 text-sm text-green-700">
              発行済み
              {status.updatedAt ? `（${new Date(status.updatedAt).toLocaleString("ja-JP")}）` : ""}
            </p>
          ) : (
            <p className="mt-2 text-sm text-amber-700">未発行</p>
          )}
        </div>
        <Button type="button" variant="secondary" onClick={() => void handleRegenerate()} disabled={regenerating}>
          {regenerating ? "再発行中…" : status?.hasToken ? "QRを再発行" : "QRを発行"}
        </Button>
      </div>

      {error && (
        <div className="mt-3">
          <Alert type="error">{error}</Alert>
        </div>
      )}

      {displayQrUrl && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <img
            src={buildQrImageUrl(displayQrUrl)}
            alt={`${store.name}の緊急打刻QRコード`}
            width={240}
            height={240}
            className="rounded-lg border border-slate-100"
          />
          <p className="break-all text-center text-xs text-slate-600">{displayQrUrl}</p>
          <p className="text-center text-xs text-amber-700">
            このQRコードは再表示できません。必要な場合は印刷または保存してください。
          </p>
        </div>
      )}

      {!displayQrUrl && status?.hasToken && !loading && (
        <p className="mt-3 text-sm text-slate-600">
          QRコードはセキュリティのため再表示できません。「QRを再発行」で新しいコードを表示できます。
        </p>
      )}

      {!appBaseUrl && (
        <p className="mt-3 text-xs text-amber-700">
          NEXT_PUBLIC_APP_URL が未設定の場合、QRのURLが正しく生成されないことがあります。
        </p>
      )}
    </div>
  );
}
