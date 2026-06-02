"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LineGroup, Store } from "@/types/database";
import { LineNotifySetup } from "@/components/admin/LineNotifySetup";
import { StoreDeleteConfirmModal } from "@/components/admin/StoreDeleteConfirmModal";
import { StoreQrPanel } from "@/components/admin/StoreQrPanel";
import { useAdminCompany } from "@/components/admin/AdminCompanyProvider";
import type { Company } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Toast } from "@/components/ui/Toast";

type Props = {
  initialStores: Store[];
  initialGroups: LineGroup[];
  addFriendUrl: string | null;
  webhookUrl: string;
  appBaseUrl: string;
  companies?: Pick<Company, "id" | "name">[];
};

type StoreEditDraft = {
  name: string;
  address: string;
  phone: string;
  manager_name: string;
  line_group_id: string;
  line_notify_enabled: boolean;
};

function storeToDraft(store: Store): StoreEditDraft {
  return {
    name: store.name,
    address: store.address ?? "",
    phone: store.phone ?? "",
    manager_name: store.manager_name ?? "",
    line_group_id: store.line_group_id ?? "",
    line_notify_enabled: store.line_notify_enabled,
  };
}

export function StoreManager({
  initialStores,
  initialGroups,
  addFriendUrl,
  webhookUrl,
  appBaseUrl,
  companies = [],
}: Props) {
  const { companyId, isSuperAdmin, role } = useAdminCompany();
  const canDeleteStore = !isSuperAdmin && role === "company_admin";
  const [stores, setStores] = useState(initialStores);
  const [groups] = useState(initialGroups);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [newStoreCompanyId, setNewStoreCompanyId] = useState(
    companyId ?? companies[0]?.id ?? ""
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<StoreEditDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Store | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createClient();

  const refreshStores = async () => {
    const { data } = await supabase.from("stores").select("*").order("name");
    setStores((data as Store[]) ?? []);
  };

  useEffect(() => {
    if (!expandedId) {
      setEditDraft(null);
      return;
    }
    const store = stores.find((item) => item.id === expandedId);
    if (store) {
      setEditDraft(storeToDraft(store));
    }
  }, [expandedId, stores]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const targetCompanyId = isSuperAdmin ? newStoreCompanyId : companyId;
    if (!targetCompanyId) {
      setMessage("会社が特定できません");
      return;
    }
    const { error } = await supabase.from("stores").insert({
      company_id: targetCompanyId,
      name,
      address: address || null,
      phone: phone || null,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setName("");
    setAddress("");
    setPhone("");
    setMessage("店舗を追加しました");
    await refreshStores();
  };

  const handleToggleActive = async (store: Store) => {
    await supabase.from("stores").update({ is_active: !store.is_active }).eq("id", store.id);
    await refreshStores();
  };

  const handleDeleteStore = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setDeleteError(null);
    setMessage(null);

    const storeId = deleteTarget.id;

    try {
      console.log("[stores/delete] request", { storeId, storeName: deleteTarget.name });

      const res = await fetch(`/api/admin/stores/${storeId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      let data: {
        ok?: boolean;
        deletedId?: string;
        error?: string;
        message?: string;
        code?: string | null;
        details?: string | null;
        reasons?: string[];
        counts?: { employees: number; attendance: number };
      } = {};

      try {
        data = await res.json();
      } catch (parseError) {
        console.error("[stores/delete] invalid JSON response", {
          status: res.status,
          parseError,
        });
        setDeleteError("サーバー応答の解析に失敗しました");
        return;
      }

      console.log("[stores/delete] response", {
        status: res.status,
        message: data.message ?? data.error ?? null,
        code: data.code ?? null,
        details: data.details ?? null,
        reasons: data.reasons ?? null,
        counts: data.counts ?? null,
      });

      if (!res.ok) {
        setDeleteError(data.error ?? data.message ?? "店舗の削除に失敗しました");
        return;
      }

      if (expandedId === storeId) {
        setExpandedId(null);
        setEditDraft(null);
      }

      setStores((current) => current.filter((store) => store.id !== storeId));
      setDeleteTarget(null);
      setDeleteError(null);
      setToast("店舗を削除しました");
      void refreshStores();
    } catch (error) {
      console.error("[stores/delete] network error", {
        message: error instanceof Error ? error.message : String(error),
      });
      setDeleteError("店舗の削除に失敗しました（通信エラー）");
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveEdit = async (storeId: string) => {
    if (!editDraft) return;

    setSaving(true);
    setMessage(null);
    const store = stores.find((item) => item.id === storeId);

    const { error } = await supabase
      .from("stores")
      .update({
        name: editDraft.name.trim(),
        address: editDraft.address.trim() || null,
        phone: editDraft.phone.trim() || null,
        manager_name: editDraft.manager_name.trim() || null,
        line_group_id: editDraft.line_group_id || null,
        line_notify_enabled: editDraft.line_notify_enabled,
      })
      .eq("id", storeId);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (editDraft.line_group_id && store) {
      await supabase
        .from("line_groups")
        .update({ company_id: store.company_id })
        .eq("group_id", editDraft.line_group_id)
        .is("company_id", null);
    }

    setMessage("店舗情報を更新しました");
    await refreshStores();
  };

  const selectedGroupLabel = (groupId: string | null) => {
    if (!groupId) return "通知グループを選択";
    return groups.find((group) => group.group_id === groupId)?.group_name ?? groupId;
  };

  const isSuccessMessage = (text: string) =>
    text.includes("追加") || text.includes("更新");

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      {message && (
        <Alert type={isSuccessMessage(message) ? "success" : "error"}>{message}</Alert>
      )}

      <LineNotifySetup
        initialGroups={groups}
        addFriendUrl={addFriendUrl}
        webhookUrl={webhookUrl}
      />

      <Card>
        <h3 className="font-semibold">新規店舗</h3>
        <form onSubmit={handleAdd} className="mt-4 grid gap-3 sm:grid-cols-2">
          {isSuperAdmin && companies.length > 0 && (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-slate-600">所属会社</label>
              <select
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                value={newStoreCompanyId}
                onChange={(e) => setNewStoreCompanyId(e.target.value)}
                required
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm text-slate-600">店舗名</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">電話番号</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-slate-600">住所</label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" fullWidth>
              追加
            </Button>
          </div>
        </form>
      </Card>

      <div className="space-y-3">
        {stores.map((store) => (
          <Card key={store.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {store.name}
                  {!store.is_active && (
                    <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                      無効
                    </span>
                  )}
                  {store.line_notify_enabled && store.line_group_id && (
                    <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                      LINE通知ON
                    </span>
                  )}
                </p>
                {store.manager_name && (
                  <p className="text-sm text-slate-600">管理者：{store.manager_name}</p>
                )}
                {store.line_group_id && (
                  <p className="text-sm text-slate-500">
                    通知先：{selectedGroupLabel(store.line_group_id)}
                  </p>
                )}
                {store.address && <p className="text-sm text-slate-500">{store.address}</p>}
                {store.phone && <p className="text-sm text-slate-500">TEL: {store.phone}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  onClick={() => {
                    setMessage(null);
                    setExpandedId(expandedId === store.id ? null : store.id);
                  }}
                >
                  {expandedId === store.id ? "閉じる" : "編集"}
                </Button>
                <Button variant="secondary" onClick={() => handleToggleActive(store)}>
                  {store.is_active ? "無効化" : "有効化"}
                </Button>
                {canDeleteStore && (
                  <Button
                    variant="danger"
                    onClick={() => {
                      setMessage(null);
                      setDeleteError(null);
                      setDeleteTarget(store);
                    }}
                  >
                    削除
                  </Button>
                )}
              </div>
            </div>

            {expandedId === store.id && editDraft && (
              <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-600">店舗名</label>
                  <Input
                    value={editDraft.name}
                    onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-600">管理者名</label>
                  <Input
                    value={editDraft.manager_name}
                    placeholder="例：田中 太郎"
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, manager_name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-600">電話番号</label>
                  <Input
                    value={editDraft.phone}
                    onChange={(e) => setEditDraft({ ...editDraft, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-600">LINE通知グループ</label>
                  <select
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    value={editDraft.line_group_id}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, line_group_id: e.target.value })
                    }
                  >
                    <option value="">通知グループを選択</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.group_id}>
                        {group.group_name ?? group.group_id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    上の「グループ一覧を更新」で Bot 参加グループを読み込んでから選択してください。
                  </p>
                </div>
                <div className="flex items-end">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={editDraft.line_notify_enabled}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, line_notify_enabled: e.target.checked })
                      }
                    />
                    LINE通知を有効にする
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm text-slate-600">住所</label>
                  <Input
                    value={editDraft.address}
                    onChange={(e) => setEditDraft({ ...editDraft, address: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button type="button" onClick={() => handleSaveEdit(store.id)} disabled={saving}>
                    {saving ? "保存中…" : "保存"}
                  </Button>
                </div>

                <div className="sm:col-span-2">
                  <StoreQrPanel store={store} appBaseUrl={appBaseUrl} />
                </div>
              </div>
            )}
          </Card>
        ))}
        {stores.length === 0 && (
          <p className="text-center text-sm text-slate-500">店舗が登録されていません</p>
        )}
      </div>

      {deleteTarget && (
        <StoreDeleteConfirmModal
          storeName={deleteTarget.name}
          deleting={deleting}
          errorMessage={deleteError}
          onConfirm={handleDeleteStore}
          onClose={() => {
            if (!deleting) {
              setDeleteTarget(null);
              setDeleteError(null);
            }
          }}
        />
      )}
    </div>
  );
}
