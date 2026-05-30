"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EmployeeWithStore, Store } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { FaceRegister } from "@/components/admin/FaceRegister";
import { formatYen } from "@/lib/format";

type Props = {
  initialEmployees: EmployeeWithStore[];
  stores: Pick<Store, "id" | "name" | "is_active">[];
};

export function EmployeeManager({ initialEmployees, stores }: Props) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const activeStores = stores.filter((s) => s.is_active);
  const [storeId, setStoreId] = useState(activeStores[0]?.id ?? stores[0]?.id ?? "");
  const [hourlyRate, setHourlyRate] = useState("1000");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createClient();

  const refresh = async () => {
    const { data } = await supabase
      .from("employees")
      .select("*, stores(id, name)")
      .order("created_at", { ascending: false });
    setEmployees((data as EmployeeWithStore[]) ?? []);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!storeId) {
      setMessage("店舗を先に登録してください");
      return;
    }
    const { error } = await supabase.from("employees").insert({
      name,
      employee_code: code,
      store_id: storeId,
      hourly_rate: Number(hourlyRate),
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setName("");
    setCode("");
    setHourlyRate("1000");
    setMessage("従業員を追加しました");
    await refresh();
  };

  const handleRateUpdate = async (id: string, rate: string) => {
    const { error } = await supabase
      .from("employees")
      .update({ hourly_rate: Number(rate) })
      .eq("id", id);
    if (!error) await refresh();
  };

  const handleStoreUpdate = async (id: string, newStoreId: string) => {
    const { error } = await supabase
      .from("employees")
      .update({ store_id: newStoreId })
      .eq("id", id);
    if (!error) await refresh();
  };

  const handleToggleActive = async (emp: EmployeeWithStore) => {
    await supabase.from("employees").update({ is_active: !emp.is_active }).eq("id", emp.id);
    await refresh();
  };

  const handleFaceSave = async (id: string, descriptor: number[]) => {
    await supabase.from("employees").update({ face_descriptor: descriptor }).eq("id", id);
    await refresh();
  };

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="font-semibold">新規従業員</h3>
        {activeStores.length === 0 ? (
          <p className="mt-3 text-sm text-amber-700">
            店舗が未登録です。先に店舗管理から店舗を追加してください。
          </p>
        ) : (
          <form onSubmit={handleAdd} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-600">氏名</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600">社員コード</label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600">所属店舗</label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                required
              >
                {activeStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600">時給（円）</label>
              <Input
                type="number"
                min={1}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                required
              />
            </div>
            <div className="flex items-end sm:col-span-2">
              <Button type="submit" fullWidth>
                追加
              </Button>
            </div>
          </form>
        )}
        {message && (
          <div className="mt-3">
            <Alert type={message.includes("追加") ? "success" : "error"}>{message}</Alert>
          </div>
        )}
      </Card>

      <div className="space-y-3">
        {employees.map((emp) => (
          <Card key={emp.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {emp.name}
                  {!emp.is_active && (
                    <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                      無効
                    </span>
                  )}
                </p>
                <p className="text-sm text-slate-500">コード: {emp.employee_code}</p>
                <p className="text-sm text-slate-500">
                  所属: {emp.stores?.name ?? "—"}
                </p>
                <p className="text-sm text-slate-600">
                  時給: {formatYen(Number(emp.hourly_rate))}
                  <span className="text-slate-400">（22時以降 ×1.25）</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => setExpandedId(expandedId === emp.id ? null : emp.id)}>
                  {expandedId === emp.id ? "閉じる" : "編集"}
                </Button>
                <Button variant="secondary" onClick={() => handleToggleActive(emp)}>
                  {emp.is_active ? "無効化" : "有効化"}
                </Button>
              </div>
            </div>

            {expandedId === emp.id && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <label className="mb-1 block text-sm text-slate-600">所属店舗</label>
                <select
                  defaultValue={emp.store_id}
                  onChange={(e) => handleStoreUpdate(emp.id, e.target.value)}
                  className="mb-4 w-full max-w-xs rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <label className="mb-1 block text-sm text-slate-600">時給を変更</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    defaultValue={emp.hourly_rate}
                    onBlur={(e) => handleRateUpdate(emp.id, e.target.value)}
                  />
                </div>
                <div className="mt-4">
                  <p className="mb-2 text-sm font-medium text-slate-700">顔認証登録</p>
                  <FaceRegister
                    hasFace={!!emp.face_descriptor}
                    onSave={(d) => handleFaceSave(emp.id, d)}
                  />
                </div>
              </div>
            )}
          </Card>
        ))}
        {employees.length === 0 && (
          <p className="text-center text-sm text-slate-500">従業員が登録されていません</p>
        )}
      </div>
    </div>
  );
}
