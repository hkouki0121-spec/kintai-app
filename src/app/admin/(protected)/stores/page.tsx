import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyContext } from "@/lib/auth/company-context";
import { StoreManager } from "@/components/admin/StoreManager";
import type { Company, LineGroup, Store } from "@/types/database";

function resolveWebhookUrl(host: string | null): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return `${configured}/api/line/webhook`;
  if (host) return `https://${host}/api/line/webhook`;
  return "/api/line/webhook";
}

export default async function StoresPage() {
  const supabase = await createClient();
  const context = await requireCompanyContext(supabase);
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");

  const [{ data: stores }, { data: groups }, { data: companies }] = await Promise.all([
    supabase.from("stores").select("*").order("name"),
    supabase.from("line_groups").select("*").order("last_seen_at", { ascending: false }),
    context.isSuperAdmin
      ? supabase.from("companies").select("id, name").eq("is_active", true).order("name")
      : Promise.resolve({ data: [] as Pick<Company, "id" | "name">[] }),
  ]);

  const addFriendUrl = process.env.NEXT_PUBLIC_LINE_ADD_FRIEND_URL?.trim() || null;
  const webhookUrl = resolveWebhookUrl(host);
  const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    (host ? `https://${host}` : "");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">店舗管理</h2>
        <p className="text-sm text-slate-600">
          店舗の追加・編集、LINE 通知グループ、緊急打刻用QRコードの管理ができます。
        </p>
      </div>
      <StoreManager
        initialStores={(stores as Store[]) ?? []}
        initialGroups={(groups as LineGroup[]) ?? []}
        addFriendUrl={addFriendUrl}
        webhookUrl={webhookUrl}
        appBaseUrl={appBaseUrl}
        companies={(companies as Pick<Company, "id" | "name">[]) ?? []}
      />
    </div>
  );
}
