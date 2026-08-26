"use client";

import { StoreManager } from "@/components/admin/StoreManager";
import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";
import { useAdminCompany } from "@/components/admin/AdminCompanyProvider";
import { useShowPageSkeleton, useStoreManagerQuery } from "@/lib/queries/hooks";
import { adminQueryKeys } from "@/lib/queries/keys";

function resolveWebhookUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return `${configured}/api/line/webhook`;
  if (typeof window !== "undefined") return `${window.location.origin}/api/line/webhook`;
  return "/api/line/webhook";
}

function resolveAppBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function StoresPageClient() {
  const { isSuperAdmin } = useAdminCompany();
  const { data } = useStoreManagerQuery(isSuperAdmin);
  const ready = !!data;
  const showSkeleton = useShowPageSkeleton(ready, "/admin/stores", adminQueryKeys.storeManager);

  if (showSkeleton) {
    return <AdminPageSkeleton pathname="/admin/stores" variant="table" />;
  }

  if (!data) return null;

  const addFriendUrl = process.env.NEXT_PUBLIC_LINE_ADD_FRIEND_URL?.trim() || null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">店舗管理</h2>
        <p className="text-sm text-slate-600">
          店舗の追加・編集、LINE 通知グループ、緊急打刻用QRコードの管理ができます。
        </p>
      </div>
      <StoreManager
        stores={data.stores}
        groups={data.groups}
        addFriendUrl={addFriendUrl}
        webhookUrl={resolveWebhookUrl()}
        appBaseUrl={resolveAppBaseUrl()}
        companies={data.companies}
      />
    </div>
  );
}
