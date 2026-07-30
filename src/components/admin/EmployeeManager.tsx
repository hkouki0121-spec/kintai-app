"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { DuplicateEmployeeCodeGroup } from "@/lib/employees/duplicate-code";
import { groupEmployeesByStore } from "@/lib/employees/group-by-store";
import { downloadEmployeesCsv } from "@/lib/csv/export-employees-csv";
import type { EmployeeWithStore, Store } from "@/types/database";
import { ALL_STORES_VALUE } from "@/lib/stores/constants";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import dynamic from "next/dynamic";

const FaceRegisterModal = dynamic(
  () =>
    import("@/components/admin/FaceRegisterModal").then((mod) => ({
      default: mod.FaceRegisterModal,
    })),
  { ssr: false }
);
import { EmployeeDeleteConfirmModal } from "@/components/admin/EmployeeDeleteConfirmModal";
import type { FaceDescriptorEntry } from "@/types/database";
import { formatJstDate, formatYen } from "@/lib/format";
import { invalidateEmployees } from "@/lib/queries/invalidate";

type DeleteTarget = {
  employee: EmployeeWithStore;
  attendanceCount: number;
  payrollCount: number;
};

type Props = {
  employees: EmployeeWithStore[];
  stores: Pick<Store, "id" | "name" | "is_active" | "company_id">[];
  duplicateCodes: DuplicateEmployeeCodeGroup[];
};

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
      在籍中
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
      無効
    </span>
  );
}

function getHireDate(emp: EmployeeWithStore): string {
  return formatJstDate(emp.created_at);
}

function formatApiError(payload: {
  error?: string;
  message?: string;
  code?: string | null;
  details?: string | null;
}): string {
  const parts = [payload.error ?? payload.message ?? "保存に失敗しました"];
  if (payload.code) parts.push(`code: ${payload.code}`);
  if (payload.details) parts.push(`details: ${payload.details}`);
  return parts.join("\n");
}

export function EmployeeManager({ employees, stores, duplicateCodes }: Props) {
  const queryClient = useQueryClient();
  const [filterStoreId, setFilterStoreId] = useState(ALL_STORES_VALUE);
  const [search, setSearch] = useState("");
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeWithStore | null>(null);
  const [faceRegisterTarget, setFaceRegisterTarget] = useState<EmployeeWithStore | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const activeStores = stores.filter((store) => store.is_active);
  const filterStores = useMemo(
    () => stores.filter((store) => store.is_active).sort((a, b) => a.name.localeCompare(b.name, "ja")),
    [stores]
  );

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(query) ||
        emp.employee_code.toLowerCase().includes(query)
    );
  }, [employees, search]);

  const groupedEmployees = useMemo(
    () => groupEmployeesByStore(filteredEmployees, stores, filterStoreId),
    [filteredEmployees, stores, filterStoreId]
  );

  const refresh = async () => {
    await invalidateEmployees(queryClient);
  };

  const toggleStore = (storeId: string) => {
    setExpandedStores((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  };

  const handleToggleActive = async (emp: EmployeeWithStore) => {
    await supabase.from("employees").update({ is_active: !emp.is_active }).eq("id", emp.id);
    await refresh();
  };

  const handleDeleteClick = async (emp: EmployeeWithStore) => {
    setMessage(null);
    const [{ count: attendanceCount }, { count: payrollCount }] = await Promise.all([
      supabase.from("attendance_records").select("*", { count: "exact", head: true }).eq("employee_id", emp.id),
      supabase.from("monthly_payroll").select("*", { count: "exact", head: true }).eq("employee_id", emp.id),
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
    const { error } = await supabase.from("employees").delete().eq("id", deleteTarget.employee.id);
    setDeleting(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setDeleteTarget(null);
    setMessage(`${deleteTarget.employee.name} を削除しました`);
    await refresh();
  };

  const handleFaceUpdate = async (id: string, descriptors: FaceDescriptorEntry[]) => {
    const { error } = await supabase
      .from("employees")
      .update({ face_descriptor: descriptors.length > 0 ? descriptors : null })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await refresh();
  };

  const handleExportCsv = () => {
    const flat = groupedEmployees.flatMap((g) => g.employees);
    if (flat.length === 0) {
      setMessage("出力する従業員がありません");
      return;
    }
    downloadEmployeesCsv(flat);
    setMessage("CSVを出力しました");
  };

  const isSuccessMessage =
    message?.includes("追加") ||
    message?.includes("更新") ||
    message?.includes("削除しました") ||
    message?.includes("CSV") ||
    message?.includes("顔写真");

  return (
    <div className="pb-24 md:pb-0">
      {duplicateCodes.length > 0 && (
        <Alert type="error">
          <p className="font-medium">社員コードの重複が検出されました。</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {duplicateCodes.map((group) => (
              <li key={`${group.companyId}:${group.employeeCode}`}>
                コード「{group.employeeCode}」: {group.employees.map((item) => item.name).join("、")}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {/* 検索バー（スマホ固定） */}
      <div className="sticky top-14 z-20 -mx-4 mb-6 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:rounded-2xl md:border md:bg-white md:px-5 md:py-4 md:shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-slate-500">検索</label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="従業員名・社員コード"
              />
            </div>
            <div className="w-full sm:w-48">
              <label className="mb-1.5 block text-xs font-medium text-slate-500">店舗フィルター</label>
              <select
                value={filterStoreId}
                onChange={(e) => setFilterStoreId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value={ALL_STORES_VALUE}>すべての店舗</option>
                {filterStores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="hidden gap-2 md:flex">
            <Button variant="secondary" onClick={handleExportCsv}>
              CSV出力
            </Button>
            <Button onClick={() => setShowAddModal(true)}>従業員追加</Button>
          </div>
        </div>
      </div>

      {message && (
        <div className="mb-4">
          <Alert type={isSuccessMessage ? "success" : "error"}>{message}</Alert>
        </div>
      )}

      {/* PC: テーブル */}
      <div className="hidden space-y-8 md:block">
        {groupedEmployees.map((group) => (
          <section key={group.storeId}>
            <h3 className="mb-4 text-lg font-bold text-slate-900">
              {group.storeName}
              <span className="ml-2 text-sm font-normal text-slate-500">（{group.employees.length}名）</span>
            </h3>
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                    <th className="px-5 py-3 font-medium">店舗名</th>
                    <th className="px-5 py-3 font-medium">社員コード</th>
                    <th className="px-5 py-3 font-medium">従業員名</th>
                    <th className="px-5 py-3 font-medium">時給</th>
                    <th className="px-5 py-3 font-medium">入社日</th>
                    <th className="px-5 py-3 font-medium">ステータス</th>
                    <th className="px-5 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {group.employees.map((emp) => (
                    <tr
                      key={emp.id}
                      className={`border-b border-slate-50 last:border-0 ${!emp.is_active ? "bg-slate-50/80 text-slate-500" : ""}`}
                    >
                      <td className="px-5 py-4">{group.storeName}</td>
                      <td className="px-5 py-4 font-mono text-xs">{emp.employee_code}</td>
                      <td className="px-5 py-4 font-medium text-slate-900">{emp.name}</td>
                      <td className="px-5 py-4">{formatYen(Number(emp.hourly_rate))}</td>
                      <td className="px-5 py-4">{getHireDate(emp)}</td>
                      <td className="px-5 py-4">
                        <StatusBadge active={emp.is_active} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => setEditTarget(emp)}>
                            編集
                          </Button>
                          <Button variant="danger" className="!px-3 !py-1.5 text-xs" onClick={() => handleDeleteClick(emp)}>
                            削除
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
        {groupedEmployees.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-500">該当する従業員がいません</p>
        )}
      </div>

      {/* スマホ: アコーディオン */}
      <div className="space-y-3 md:hidden">
        {groupedEmployees.map((group) => {
          const open = expandedStores.has(group.storeId) || groupedEmployees.length === 1;
          return (
            <div key={group.storeId} className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-4 text-left"
                onClick={() => toggleStore(group.storeId)}
              >
                <span className="font-bold text-slate-900">
                  {group.storeName}
                  <span className="ml-2 text-sm font-normal text-slate-500">（{group.employees.length}名）</span>
                </span>
                <span className="text-slate-400">{open ? "▲" : "▼"}</span>
              </button>
              {open && (
                <div className="divide-y divide-slate-100 border-t border-slate-100">
                  {group.employees.map((emp) => (
                    <div
                      key={emp.id}
                      className={`px-4 py-4 ${!emp.is_active ? "bg-slate-50 text-slate-500" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs text-slate-500">{emp.employee_code}</p>
                          <p className="mt-0.5 font-semibold text-slate-900">{emp.name}</p>
                          <p className="mt-1 text-sm">時給 {formatYen(Number(emp.hourly_rate))}</p>
                          <p className="mt-1 text-xs text-slate-500">登録日 {getHireDate(emp)}</p>
                          <div className="mt-2">
                            <StatusBadge active={emp.is_active} />
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                          <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => setEditTarget(emp)}>
                            編集
                          </Button>
                          <Button variant="danger" className="!px-3 !py-1.5 text-xs" onClick={() => handleDeleteClick(emp)}>
                            削除
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {groupedEmployees.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-500">該当する従業員がいません</p>
        )}
      </div>

      {/* スマホ: 下部固定ボタン */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-4 backdrop-blur md:hidden">
        <Button fullWidth onClick={() => setShowAddModal(true)}>
          従業員追加
        </Button>
      </div>

      {showAddModal && (
        <EmployeeFormModal
          title="従業員追加"
          stores={activeStores}
          saving={saving}
          onClose={() => !saving && setShowAddModal(false)}
          onSave={async (data) => {
            setSaving(true);
            setMessage(null);
            const response = await fetch("/api/admin/employees", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: data.name,
                employeeCode: data.code,
                storeId: data.storeId,
                hourlyRate: data.hourlyRate,
              }),
            });
            const payload = (await response.json()) as {
              error?: string;
              message?: string;
              code?: string | null;
              details?: string | null;
            };
            setSaving(false);
            if (!response.ok) {
              setMessage(formatApiError(payload));
              return;
            }
            setShowAddModal(false);
            setMessage("従業員を追加しました");
            await refresh();
          }}
        />
      )}

      {editTarget && (
        <EmployeeFormModal
          title="従業員編集"
          stores={stores}
          employee={editTarget}
          saving={saving}
          onClose={() => !saving && setEditTarget(null)}
          onFaceRegister={() => {
            setFaceRegisterTarget(editTarget);
            setEditTarget(null);
          }}
          onToggleActive={() => handleToggleActive(editTarget)}
          onSave={async (data) => {
            setSaving(true);
            setMessage(null);
            const response = await fetch(`/api/admin/employees/${editTarget.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: data.name,
                employeeCode: data.code,
                storeId: data.storeId,
                hourlyRate: data.hourlyRate,
              }),
            });
            const payload = (await response.json()) as {
              error?: string;
              message?: string;
              code?: string | null;
              details?: string | null;
            };
            setSaving(false);
            if (!response.ok) {
              setMessage(formatApiError(payload));
              return;
            }
            setEditTarget(null);
            setMessage("従業員情報を更新しました");
            await refresh();
          }}
        />
      )}

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
    </div>
  );
}

type FormData = {
  name: string;
  code: string;
  storeId: string;
  hourlyRate: string;
};

function EmployeeFormModal({
  title,
  stores,
  employee,
  saving,
  onClose,
  onSave,
  onFaceRegister,
  onToggleActive,
}: {
  title: string;
  stores: Pick<Store, "id" | "name" | "is_active" | "company_id">[];
  employee?: EmployeeWithStore;
  saving: boolean;
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
  onFaceRegister?: () => void;
  onToggleActive?: () => void;
}) {
  const activeStores = stores.filter((s) => s.is_active);
  const [name, setName] = useState(employee?.name ?? "");
  const [code, setCode] = useState(employee?.employee_code ?? "");
  const [storeId, setStoreId] = useState(employee?.store_id ?? activeStores[0]?.id ?? "");
  const [hourlyRate, setHourlyRate] = useState(String(employee?.hourly_rate ?? "1000"));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 sm:max-w-lg sm:rounded-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSave({ name, code, storeId, hourlyRate });
          }}
          className="space-y-4"
        >
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
            <Input type="number" min={1} value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} required />
          </div>
          {employee && (
            <p className="text-sm text-slate-500">
              登録日（入社日）: {formatJstDate(employee.created_at)}
            </p>
          )}
          {employee && onFaceRegister && (
            <Button type="button" variant="secondary" fullWidth onClick={onFaceRegister}>
              顔写真管理
            </Button>
          )}
          {employee && onToggleActive && (
            <Button type="button" variant="secondary" fullWidth onClick={onToggleActive}>
              {employee.is_active ? "無効化" : "有効化"}
            </Button>
          )}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" fullWidth onClick={onClose} disabled={saving}>
              キャンセル
            </Button>
            <Button type="submit" fullWidth disabled={saving || (!employee && activeStores.length === 0)}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
