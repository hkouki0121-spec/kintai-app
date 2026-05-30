"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Store } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";

type Props = {
  initialStores: Store[];
};

export function StoreManager({ initialStores }: Props) {
  const [stores, setStores] = useState(initialStores);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createClient();

  const refresh = async () => {
    const { data } = await supabase.from("stores").select("*").order("name");
    setStores((data as Store[]) ?? []);
  };

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
    await refresh();
  };

  const handleUpdate = async (
    id: string,
    fields: Partial<Pick<Store, "name" | "address" | "phone">>
  ) => {
    const { error } = await supabase.from("stores").update(fields).eq("id", id);
    if (error) setMessage(error.message);
    else await refresh();
  };

  const handleToggleActive = async (store: Store) => {
    await supabase.from("stores").update({ is_active: !store.is_active }).eq("id", store.id);
    await refresh();
  };

  return (
    <div className="space-y-6">
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
        {message && (
          <div className="mt-3">
            <Alert type={message.includes("追加") ? "success" : "error"}>{message}</Alert>
          </div>
        )}
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
                </p>
                {store.address && <p className="text-sm text-slate-500">{store.address}</p>}
                {store.phone && <p className="text-sm text-slate-500">TEL: {store.phone}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setExpandedId(expandedId === store.id ? null : store.id)}
                >
                  {expandedId === store.id ? "閉じる" : "編集"}
                </Button>
                <Button variant="secondary" onClick={() => handleToggleActive(store)}>
                  {store.is_active ? "無効化" : "有効化"}
                </Button>
              </div>
            </div>

            {expandedId === store.id && (
              <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-600">店舗名</label>
                  <Input
                    defaultValue={store.name}
                    onBlur={(e) => handleUpdate(store.id, { name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-600">電話番号</label>
                  <Input
                    defaultValue={store.phone ?? ""}
                    onBlur={(e) =>
                      handleUpdate(store.id, { phone: e.target.value || null })
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm text-slate-600">住所</label>
                  <Input
                    defaultValue={store.address ?? ""}
                    onBlur={(e) =>
                      handleUpdate(store.id, { address: e.target.value || null })
                    }
                  />
                </div>
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
