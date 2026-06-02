"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LineGroup, Store } from "@/types/database";
import { LineNotifySetup } from "@/components/admin/LineNotifySetup";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";

type Props = {
  initialStores: Store[];
  initialGroups: LineGroup[];
  addFriendUrl: string | null;
  webhookUrl: string;
};

type StoreEditDraft = {
  name: string;
  address: string;
  phone: string;
  manager_name: string;
  latitude: string;
  longitude: string;
  line_group_id: string;
  line_notify_enabled: boolean;
};

const GEOCODE_FAILURE_MESSAGE =
  "住所から座標を取得できませんでした。手動で入力してください";

function storeToDraft(store: Store): StoreEditDraft {
  return {
    name: store.name,
    address: store.address ?? "",
    phone: store.phone ?? "",
    manager_name: store.manager_name ?? "",
    latitude: store.latitude != null ? String(store.latitude) : "",
    longitude: store.longitude != null ? String(store.longitude) : "",
    line_group_id: store.line_group_id ?? "",
    line_notify_enabled: store.line_notify_enabled,
  };
}

export function StoreManager({ initialStores, initialGroups, addFriendUrl, webhookUrl }: Props) {
  const [stores, setStores] = useState(initialStores);
  const [groups] = useState(initialGroups);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<StoreEditDraft | null>(null);
  const [geocoding, setGeocoding] = useState(false);
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
    const { error } = await supabase.from("stores").insert({
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

  const handleGeocodeFromAddress = async () => {
    if (!editDraft) return;
    const addressValue = editDraft.address.trim();
    if (!addressValue) {
      setMessage("住所を入力してから座標を取得してください");
      return;
    }

    setGeocoding(true);
    setMessage(null);

    try {
      const params = new URLSearchParams({ address: addressValue });
      const response = await fetch(`/api/geo/geocode?${params.toString()}`);
      const payload = (await response.json()) as {
        latitude?: number;
        longitude?: number;
        approximate?: boolean;
        matchedQuery?: string;
        displayName?: string;
      };

      if (!response.ok || payload.latitude == null || payload.longitude == null) {
        setMessage(GEOCODE_FAILURE_MESSAGE);
        return;
      }

      setEditDraft({
        ...editDraft,
        latitude: String(payload.latitude),
        longitude: String(payload.longitude),
      });
      setMessage(
        payload.approximate
          ? `座標を取得しました（${payload.matchedQuery ?? "近似位置"}）。番地レベルではないため、必要なら手動で調整してから保存してください。`
          : "座標を取得しました。保存ボタンで登録してください。"
      );
    } catch {
      setMessage(GEOCODE_FAILURE_MESSAGE);
    } finally {
      setGeocoding(false);
    }
  };

  const handleSaveEdit = async (storeId: string) => {
    if (!editDraft) return;

    setSaving(true);
    setMessage(null);

    const latitude = editDraft.latitude.trim();
    const longitude = editDraft.longitude.trim();

    const { error } = await supabase
      .from("stores")
      .update({
        name: editDraft.name.trim(),
        address: editDraft.address.trim() || null,
        phone: editDraft.phone.trim() || null,
        manager_name: editDraft.manager_name.trim() || null,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        line_group_id: editDraft.line_group_id || null,
        line_notify_enabled: editDraft.line_notify_enabled,
      })
      .eq("id", storeId);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("店舗情報を更新しました");
    await refreshStores();
  };

  const selectedGroupLabel = (groupId: string | null) => {
    if (!groupId) return "通知グループを選択";
    return groups.find((group) => group.group_id === groupId)?.group_name ?? groupId;
  };

  const isSuccessMessage = (text: string) =>
    text.includes("追加") ||
    text.includes("更新") ||
    text.includes("座標を取得しました");

  return (
    <div className="space-y-6">
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
                {store.latitude != null && store.longitude != null && (
                  <p className="text-sm text-slate-500">
                    座標: {store.latitude.toFixed(6)}, {store.longitude.toFixed(6)}
                  </p>
                )}
                {store.phone && <p className="text-sm text-slate-500">TEL: {store.phone}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
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
                <div>
                  <label className="mb-1 block text-sm text-slate-600">緯度 (latitude)</label>
                  <Input
                    type="number"
                    step="any"
                    value={editDraft.latitude}
                    placeholder="例: 35.681236"
                    onChange={(e) => setEditDraft({ ...editDraft, latitude: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-600">経度 (longitude)</label>
                  <Input
                    type="number"
                    step="any"
                    value={editDraft.longitude}
                    placeholder="例: 139.767125"
                    onChange={(e) => setEditDraft({ ...editDraft, longitude: e.target.value })}
                  />
                </div>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleGeocodeFromAddress}
                    disabled={geocoding || saving}
                  >
                    {geocoding ? "取得中…" : "住所から座標を取得"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleSaveEdit(store.id)}
                    disabled={geocoding || saving}
                  >
                    {saving ? "保存中…" : "保存"}
                  </Button>
                </div>
                <p className="text-xs text-slate-500 sm:col-span-2">
                  「住所から座標を取得」で OpenStreetMap (Nominatim) から緯度・経度を自動入力します。
                  取得後は「保存」ボタンで stores テーブルに反映してください。打刻は店舗から50m以内のみ可能です。
                </p>
              </div>
            )}
          </Card>
        ))}
        {stores.length === 0 && (
          <p className="text-center text-sm text-slate-500">店舗が登録されていません</p>
        )}
      </div>
    </div>
  );
}
