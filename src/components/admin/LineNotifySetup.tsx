"use client";

import { useCallback, useState } from "react";
import type { LineGroup } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";

type Props = {
  initialGroups: LineGroup[];
  addFriendUrl: string | null;
  webhookUrl: string;
};

export function LineNotifySetup({ initialGroups, addFriendUrl, webhookUrl }: Props) {
  const [groups, setGroups] = useState(initialGroups);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyText = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setMessage("コピーに失敗しました。手動で選択してコピーしてください。");
    }
  }, []);

  const refreshGroups = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/line/groups");
      const payload = (await response.json()) as { groups?: LineGroup[]; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "グループ一覧の取得に失敗しました");
      }
      setGroups(payload.groups ?? []);
      setMessage(
        (payload.groups?.length ?? 0) > 0
          ? `グループを ${payload.groups?.length ?? 0} 件読み込みました`
          : "Bot が参加しているグループがまだありません。下記手順でグループに追加してください。"
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "グループ一覧の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <Card className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">LINE 通知セットアップ</h3>
        <p className="mt-1 text-sm text-slate-600">
          Bot をグループに招待すると、参加グループが自動で一覧に表示されます。店舗ごとに通知先グループを選ぶだけで設定完了です。
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-800">① Bot を友だち追加</p>
          {addFriendUrl ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => window.open(addFriendUrl, "_blank", "noopener,noreferrer")}
              >
                LINE友だち追加
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => copyText("friend", addFriendUrl)}
              >
                {copiedKey === "friend" ? "コピーしました" : "URLをコピー"}
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-amber-700">
              NEXT_PUBLIC_LINE_ADD_FRIEND_URL が未設定です。Vercel の環境変数を設定してください。
            </p>
          )}
          {addFriendUrl && (
            <p className="mt-2 break-all text-xs text-slate-500">{addFriendUrl}</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-800">② グループIDを取得</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-slate-600">
            <li>LINEグループに Bot を招待</li>
            <li>グループで「テスト」などメッセージを1通送信</li>
            <li>下の「グループ一覧を更新」を押す</li>
          </ol>
          <Button
            type="button"
            className="mt-3"
            variant="secondary"
            onClick={() => refreshGroups()}
            disabled={loading}
          >
            {loading ? "更新中…" : "グループ一覧を更新"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-800">③ Bot が参加しているグループ</p>
          <Button type="button" variant="ghost" onClick={() => refreshGroups()} disabled={loading}>
            再読込
          </Button>
        </div>

        {groups.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            まだグループがありません。Bot をグループに招待してメッセージを送った後、「グループ一覧を更新」を押してください。
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {groups.map((group) => (
              <li
                key={group.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{group.group_name}</p>
                  <p className="font-mono text-xs text-slate-500">{group.group_id}</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => copyText(group.group_id, group.group_id)}
                >
                  {copiedKey === group.group_id ? "コピーしました" : "グループIDをコピー"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Alert type="info">
        LINE Developers Console の Webhook URL に以下を設定してください（Use webhook: ON）。
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="break-all text-xs">{webhookUrl}</code>
          <Button type="button" variant="ghost" onClick={() => copyText("webhook", webhookUrl)}>
            {copiedKey === "webhook" ? "コピーしました" : "Webhook URLをコピー"}
          </Button>
        </div>
      </Alert>

      {message && (
        <Alert type={message.includes("失敗") ? "error" : "success"}>{message}</Alert>
      )}
    </Card>
  );
}
