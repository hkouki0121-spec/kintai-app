"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  assertUniqueEmployeeCode,
  getEmployeeCodeErrorMessage,
  type DuplicateEmployeeCodeGroup,
} from "@/lib/employees/duplicate-code";
import { groupEmployeesByStore } from "@/lib/employees/group-by-store";
import type { EmployeeWithStore, Store } from "@/types/database";
import { ALL_STORES_VALUE } from "@/lib/stores/constants";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { StoreSelect } from "@/components/admin/StoreSelect";
import { FaceRegisterModal } from "@/components/admin/FaceRegisterModal";
import { EmployeeDeleteConfirmModal } from "@/components/admin/EmployeeDeleteConfirmModal";
import { countFaceDescriptors } from "@/lib/face/descriptors";
import { MAX_FACE_DESCRIPTORS } from "@/lib/face/registration-steps";
import { FACE_MATCH_MIN_RATE } from "@/lib/constants";
import { formatYen } from "@/lib/format";
import type { FaceDescriptorEntry } from "@/types/database";
import { useAdminCompany } from "@/components/admin/AdminCompanyProvider";

type DeleteTarget = {
  employee: EmployeeWithStore;
  attendanceCount: number;
  payrollCount: number;
};

type Props = {
  initialEmployees: EmployeeWithStore[];
  stores: Pick<Store, "id" | "name" | "is_active" | "company_id">[];
  duplicateCodes: DuplicateEmployeeCodeGroup[];
};

function EmployeeCard({
  emp,
  stores,
  expandedId,
  onExpand,
  onFaceRegister,
  onToggleActive,
  onDelete,
  onStoreUpdate,
  onRateUpdate,
  onCodeUpdate,
}: {
  emp: EmployeeWithStore;
  stores: Pick<Store, "id" | "name">[];
  expandedId: string | null;
  onExpand: (id: string | null) => void;
  onFaceRegister: (emp: EmployeeWithStore) => void;
  onToggleActive: (emp: EmployeeWithStore) => void;
  onDelete: (emp: EmployeeWithStore) => void;
  onStoreUpdate: (id: string, storeId: string) => Promise<void>;
  onRateUpdate: (id: string, rate: string) => Promise<void>;
  onCodeUpdate: (id: string, code: string) => Promise<void>;
}) {
  const [codeDraft, setCodeDraft] = useState(emp.employee_code);

  return (
    <Card>
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
          <p className="text-sm text-slate-600">
            時給: {formatYen(Number(emp.hourly_rate))}
            <span className="text-slate-400">（22時以降 ×1.25）</span>
          </p>
          <p className="mt-1 text-sm">
            登録顔写真:{" "}
            {countFaceDescriptors(emp.face_descriptor) > 0 ? (
              <span className="font-medium text-emerald-700">
                {countFaceDescriptors(emp.face_descriptor)}/{MAX_FACE_DESCRIPTORS}枚
              </span>
            ) : (
              <span className="text-amber-700">0/{MAX_FACE_DESCRIPTORS}枚（未登録）</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => onFaceRegister(emp)}>
            顔写真管理
          </Button>
          <Button variant="ghost" onClick={() => onExpand(expandedId === emp.id ? null : emp.id)}>
            {expandedId === emp.id ? "閉じる" : "編集"}
          </Button>
          <Button variant="secondary" onClick={() => onToggleActive(emp)}>
            {emp.is_active ? "無効化" : "有効化"}
          </Button>
          <Button variant="danger" onClick={() => onDelete(emp)}>
            削除
          </Button>
        </div>
      </div>

      {expandedId === emp.id && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-4 text-sm text-slate-600">
            登録顔写真: {countFaceDescriptors(emp.face_descriptor)}/{MAX_FACE_DESCRIPTORS}枚
            ／ 一致率閾値: {FACE_MATCH_MIN_RATE}%
          </p>
          <label className="mb-1 block text-sm text-slate-600">社員コード</label>
          <Input
            value={codeDraft}
            onChange={(e) => setCodeDraft(e.target.value)}
            onBlur={() => {
              if (codeDraft.trim() !== emp.employee_code) {
                void onCodeUpdate(emp.id, codeDraft);
              }
            }}
            className="mb-4 max-w-xs"
          />
          <label className="mb-1 block text-sm text-slate-600">所属店舗</label>
          <select
            defaultValue={emp.store_id}
            onChange={(e) => onStoreUpdate(emp.id, e.target.value)}
            className="mb-4 w-full max-w-xs rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
          <label className="mb-1 block text-sm text-slate-600">時給を変更</label>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              defaultValue={emp.hourly_rate}
              onBlur={(e) => onRateUpdate(emp.id, e.target.value)}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

export function EmployeeManager({ initialEmployees, stores, duplicateCodes }: Props) {
  const { companyId } = useAdminCompany();
  const [employees, setEmployees] = useState(initialEmployees);
  const [filterStoreId, setFilterStoreId] = useState(ALL_STORES_VALUE);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const activeStores = stores.filter((store) => store.is_active);
  const [storeId, setStoreId] = useState(activeStores[0]?.id ?? stores[0]?.id ?? "");
  const [hourlyRate, setHourlyRate] = useState("1000");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [faceRegisterTarget, setFaceRegisterTarget] = useState<EmployeeWithStore | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createClient();

  const filterStores = useMemo(
    () => stores.filter((store) => store.is_active).sort((a, b) => a.name.localeCompare(b.name, "ja")),
    [stores]
  );

  const groupedEmployees = useMemo(
    () => groupEmployeesByStore(employees, stores, filterStoreId),
    [employees, stores, filterStoreId]
  );

  const refresh = async () => {
    const { data } = await supabase
      .from("employees")
      .select("*, stores(id, name)")
      .order("name");
    setEmployees((data as EmployeeWithStore[]) ?? []);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!storeId) {
      setMessage("店舗を先に登録してください");
      return;
    }
    const selectedStore = stores.find((store) => store.id === storeId);
    const targetCompanyId = selectedStore?.company_id ?? companyId;
    if (!targetCompanyId) {
      setMessage("会社が特定できません");
      return;
    }

    const trimmedCode = code.trim();
    try {
      await assertUniqueEmployeeCode(supabase, targetCompanyId, trimmedCode);
    } catch (error) {
      setMessage((error as Error).message);
      return;
    }

    const { error } = await supabase.from("employees").insert({
      name: name.trim(),
      employee_code: trimmedCode,
      store_id: storeId,
      company_id: targetCompanyId,
      hourly_rate: Number(hourlyRate),
    });
    if (error) {
      setMessage(getEmployeeCodeErrorMessage(error));
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
    if (error) {
      setMessage(error.message);
      return;
    }
    await refresh();
  };

  const handleCodeUpdate = async (id: string, nextCode: string) => {
    const trimmedCode = nextCode.trim();
    if (!trimmedCode) {
      setMessage("社員コードを入力してください");
      return;
    }

    const employee = employees.find((item) => item.id === id);
    if (!employee || trimmedCode === employee.employee_code) return;

    try {
      await assertUniqueEmployeeCode(supabase, employee.company_id, trimmedCode, id);
    } catch (error) {
      setMessage((error as Error).message);
      return;
    }

    const { error } = await supabase
      .from("employees")
      .update({ employee_code: trimmedCode })
      .eq("id", id);

    if (error) {
      setMessage(getEmployeeCodeErrorMessage(error));
      return;
    }

    await refresh();
  };

  const handleStoreUpdate = async (id: string, newStoreId: string) => {
    const selectedStore = stores.find((store) => store.id === newStoreId);
    const { error } = await supabase
      .from("employees")
      .update({
        store_id: newStoreId,
        company_id: selectedStore?.company_id,
      })
      .eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }
    await refresh();
  };

  const handleToggleActive = async (emp: EmployeeWithStore) => {
    await supabase.from("employees").update({ is_active: !emp.is_active }).eq("id", emp.id);
    await refresh();
  };

  const handleDeleteClick = async (emp: EmployeeWithStore) => {
    setMessage(null);
    const [{ count: attendanceCount }, { count: payrollCount }] = await Promise.all([
      supabase
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .eq("employee_id", emp.id),
      supabase
        .from("monthly_payroll")
        .select("*", { count: "exact", head: true })
        .eq("employee_id", emp.id),
    ]);

    setDeleteTarget({
      employee: emp,
      attendanceCount: attendanceCount ?? 0,
      payrollCount: payrollCount ?? 0,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setMessage(null);

    const { error } = await supabase
      .from("employees")
      .delete()
      .eq("id", deleteTarget.employee.id);

    setDeleting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setDeleteTarget(null);
    if (expandedId === deleteTarget.employee.id) {
      setExpandedId(null);
    }
    setMessage(`${deleteTarget.employee.name} を削除しました`);
    await refresh();
  };

  const handleFaceUpdate = async (id: string, descriptors: FaceDescriptorEntry[]) => {
    const { error } = await supabase
      .from("employees")
      .update({ face_descriptor: descriptors.length > 0 ? descriptors : null })
      .eq("id", id);
    if (error) {
      throw new Error(error.message);
    }
    await refresh();
    setFaceRegisterTarget((current) =>
      current?.id === id
        ? { ...current, face_descriptor: descriptors.length > 0 ? descriptors : null }
        : current
    );
  };

  const isSuccessMessage =
    message?.includes("追加") ||
    message?.includes("登録") ||
    message?.includes("削除しました") ||
    message?.includes("顔写真");

  return (
    <div className="space-y-6">
      {duplicateCodes.length > 0 && (
        <Alert type="error">
          <p className="font-medium">社員コードの重複が検出されました。DB制約追加前に修正してください。</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {duplicateCodes.map((group) => (
              <li key={`${group.companyId}:${group.employeeCode}`}>
                コード「{group.employeeCode}」: {group.employees.map((item) => item.name).join("、")}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <Card>
        <h3 className="font-semibold text-slate-900">顔認証設定</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">一致率閾値</dt>
            <dd className="font-semibold text-slate-900">{FACE_MATCH_MIN_RATE}%</dd>
          </div>
          <div>
            <dt className="text-slate-500">最大登録枚数</dt>
            <dd className="font-semibold text-slate-900">{MAX_FACE_DESCRIPTORS}枚 / 従業員</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">認証方式</dt>
            <dd className="text-slate-700">
              登録済み写真すべてと比較し、最も高い一致率を採用（{FACE_MATCH_MIN_RATE}%以上で打刻成功）
            </dd>
          </div>
        </dl>
      </Card>

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
                {activeStores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
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
            <Alert type={isSuccessMessage ? "success" : "error"}>{message}</Alert>
          </div>
        )}
      </Card>

      <Card>
        <StoreSelect
          stores={filterStores}
          value={filterStoreId}
          onChange={setFilterStoreId}
          label="店舗フィルター"
        />
      </Card>

      <div className="space-y-8">
        {groupedEmployees.map((group) => (
          <section key={group.storeId} className="space-y-3">
            <h3 className="border-b border-slate-200 pb-2 text-lg font-bold text-slate-900">
              {group.storeName}
            </h3>
            <div className="space-y-3">
              {group.employees.map((emp) => (
                <EmployeeCard
                  key={`${emp.id}-${emp.employee_code}`}
                  emp={emp}
                  stores={stores}
                  expandedId={expandedId}
                  onExpand={setExpandedId}
                  onFaceRegister={setFaceRegisterTarget}
                  onToggleActive={handleToggleActive}
                  onDelete={handleDeleteClick}
                  onStoreUpdate={handleStoreUpdate}
                  onRateUpdate={handleRateUpdate}
                  onCodeUpdate={handleCodeUpdate}
                />
              ))}
            </div>
          </section>
        ))}

        {faceRegisterTarget && (
          <FaceRegisterModal
            employeeId={faceRegisterTarget.id}
            employeeName={faceRegisterTarget.name}
            faceDescriptor={faceRegisterTarget.face_descriptor}
            onUpdate={handleFaceUpdate}
            onClose={() => setFaceRegisterTarget(null)}
          />
        )}
        {deleteTarget && (
          <EmployeeDeleteConfirmModal
            employeeName={deleteTarget.employee.name}
            attendanceCount={deleteTarget.attendanceCount}
            payrollCount={deleteTarget.payrollCount}
            deleting={deleting}
            onConfirm={handleDeleteConfirm}
            onClose={() => !deleting && setDeleteTarget(null)}
          />
        )}
        {groupedEmployees.length === 0 && (
          <p className="text-center text-sm text-slate-500">
            {filterStoreId === ALL_STORES_VALUE
              ? "従業員が登録されていません"
              : "この店舗に従業員が登録されていません"}
          </p>
        )}
      </div>
    </div>
  );
}
