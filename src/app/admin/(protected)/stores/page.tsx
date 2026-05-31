import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { StoreManager } from "@/components/admin/StoreManager";
import type { LineGroup, Store } from "@/types/database";

function resolveWebhookUrl(host: string | null): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return `${configured}/api/line/webhook`;
  if (host) return `https://${host}/api/line/webhook`;
  return "/api/line/webhook";
}

export default async function StoresPage() {
  const supabase = await createClient();
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");

  const [{ data: stores }, { data: groups }] = await Promise.all([
    supabase.from("stores").select("*").order("name"),
    supabase.from("line_groups").select("*").order("last_seen_at", { ascending: false }),
  ]);

  const addFriendUrl = process.env.NEXT_PUBLIC_LINE_ADD_FRIEND_URL?.trim() || null;
  const webhookUrl = resolveWebhookUrl(host);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">店舗管理</h2>
        <p className="text-sm text-slate-600">
          店舗の追加・編集と、店舗ごとの LINE 通知グループ設定ができます。
        </p>
      </div>
      <StoreManager
        initialStores={(stores as Store[]) ?? []}
        initialGroups={(groups as LineGroup[]) ?? []}
        addFriendUrl={addFriendUrl}
        webhookUrl={webhookUrl}
      />
    </div>
  );
}
