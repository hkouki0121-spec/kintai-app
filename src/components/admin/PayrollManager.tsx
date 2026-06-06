"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildPayrollCsvFilename } from "@/lib/csv/build-payroll-csv";
import { isAllStores } from "@/lib/stores/queries";
import type { PayrollWithEmployee, Store } from "@/types/database";
import { formatHoursClock, formatYen } from "@/lib/format";
import { StoreSelect } from "@/components/admin/StoreSelect";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { useAdminCompany } from "@/components/admin/AdminCompanyProvider";
import type { PayrollDiagnostics } from "@/lib/payroll/diagnostics";

type Props = {
  stores: Pick<Store, "id" | "name">[];
  initialStoreId: string;
  initialPayroll: PayrollWithEmployee[];
  initialYear: number;
  initialMonth: number;
};

function getPayrollHours(row: PayrollWithEmployee): number {
  return Number(row.regular_hours) + Number(row.night_hours);
}

function getActualTotalHours(row: PayrollWithEmployee): number {
  if (row.actual_total_hours != null) return Number(row.actual_total_hours);
  return Number(row.actual_regular_hours ?? row.regular_hours) + Number(row.actual_night_hours ?? row.night_hours);
}

export function PayrollManager({
  stores,
  initialStoreId,
  initialPayroll,
  initialYear,
  initialMonth,
}: Props) {
  const { isSuperAdmin, role } = useAdminCompany();
  const canExportCsv = !isSuperAdmin && role === "company_admin";
  const [year, setYear] = useState(String(initialYear));
  const [month, setMonth] = useState(String(initialMonth));
  const [storeId, setStoreId] = useState(initialStoreId);
  const [payroll, setPayroll] = useState(initialPayroll);
  const [loading, setLoading] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [diagnostics, setDiagnostics] = useState<PayrollDiagnostics | null>(null);
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  const loadPayroll = useCallback(async (y: number, m: number, store: string) => {
    const params = new URLSearchParams({
      year: String(y),
      month: String(m),
      storeId: store,
    });
    const res = await fetch(`/api/admin/payroll/list?${params.toString()}`);
    if (!res.ok) return;
    const data = (await res.json()) as { payroll?: PayrollWithEmployee[] };
    setPayroll(data.payroll ?? []);
  }, []);

  const loadDiagnostics = useCallback(async (y: number, m: number, store: string) => {
    const params = new URLSearchParams({ year: String(y), month: String(m), storeId: store });
    const res = await fetch(`/api/admin/payroll/diagnostics?${params.toString()}`);
    if (res.ok) {
      setDiagnostics((await res.json()) as PayrollDiagnostics);
    }
  }, []);

  const syncFromAttendance = useCallback(
    async (y: number, m: number, store: string, silent = false) => {
      if (!silent) setSyncing(true);
      try {
        const res = await fetch("/api/admin/payroll/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year: y, month: m, storeId: store }),
        });
        const data = (await res.json()) as {
          processed?: number;
          errors?: string[];
          payroll?: PayrollWithEmployee[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? "給与計算に失敗しました");
        }
        if (data.payroll) {
          setPayroll(data.payroll);
        } else {
          await loadPayroll(y, m, store);
        }
        await loadDiagnostics(y, m, store);
        return { processed: data.processed ?? 0, errors: data.errors ?? [] };
      } finally {
        if (!silent) setSyncing(false);
      }
    },
    [loadPayroll, loadDiagnostics]
  );

  useEffect(() => {
    void loadDiagnostics(initialYear, initialMonth, initialStoreId);
  }, [initialYear, initialMonth, initialStoreId, loadDiagnostics]);

  const summary = useMemo(() => {
    return payroll.reduce(
      (acc, row) => {
        acc.count += 1;
        acc.totalPay += Number(row.total_pay);
        acc.totalHours += getActualTotalHours(row);
        acc.regularHours += Number(row.actual_regular_hours ?? row.regular_hours);
        acc.nightHours += Number(row.actual_night_hours ?? row.night_hours);
        return acc;
      },
      { count: 0, totalPay: 0, totalHours: 0, regularHours: 0, nightHours: 0 }
    );
  }, [payroll]);

  const buildPayrollUrl = (y: string, m: string, store: string) => {
    const params = new URLSearchParams({ year: y, month: m });
    if (!isAllStores(store)) params.set("store", store);
    return `/admin/payroll?${params.toString()}`;
  };

  const handlePeriodChange = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildPayrollUrl(year, month, storeId));
    void syncFromAttendance(Number(year), Number(month), storeId, true);
  };

  const handleCalculate = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const y = Number(year);
      const m = Number(month);
      const result = await syncFromAttendance(y, m, storeId);
      const storeLabel = isAllStores(storeId) ? "全店舗" : stores.find((s) => s.id === storeId)?.name ?? "";
      if (result.errors.length > 0) {
        setMessage({
          type: "error",
          text: `${storeLabel} ${result.processed}件を計算しましたが、一部エラー: ${result.errors.join(", ")}`,
        });
      } else {
        setMessage({
          type: "success",
          text: `${y}年${m}月（${storeLabel}）の給与を${result.processed}名分再計算しました`,
        });
      }
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCsv = async () => {
    if (payroll.length === 0) {
      setMessage({ type: "error", text: "給与データがありません。先に給与を計算してください。" });
      return;
    }
    setCsvLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({ storeId, year, month });
      const response = await fetch(`/api/admin/payroll/csv?${params.toString()}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "CSV出力に失敗しました");
      }
      const blob = await response.blob();
      const storeLabel = isAllStores(storeId) ? "全店舗" : stores.find((s) => s.id === storeId)?.name ?? "店舗";
      const filename = buildPayrollCsvFilename(Number(year), Number(month), storeLabel);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setMessage({ type: "success", text: "給与CSVを出力しました" });
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message });
    } finally {
      setCsvLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* フィルター */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <form onSubmit={handlePeriodChange} className="flex flex-wrap items-end gap-3">
          <StoreSelect stores={stores} value={storeId} onChange={setStoreId} label="店舗" />
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">年</label>
            <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="w-28" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">月</label>
            <Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(e.target.value)} className="w-20" />
          </div>
          <Button type="submit" variant="secondary">
            表示
          </Button>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="button" onClick={handleCalculate} disabled={loading || syncing}>
            {loading ? "計算中…" : "給与を計算"}
          </Button>
          {(syncing || loading) && (
            <span className="text-xs text-slate-500">勤怠データを反映中…</span>
          )}
          {canExportCsv && (
            <Button type="button" variant="secondary" onClick={handleDownloadCsv} disabled={csvLoading || payroll.length === 0}>
              {csvLoading ? "出力中…" : "給与CSV出力"}
            </Button>
          )}
        </div>
      </div>

      {message && <Alert type={message.type}>{message.text}</Alert>}

      {diagnostics && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="font-bold text-amber-900">勤怠と給与の確認</h3>
          <p className="mt-1 text-sm text-amber-800">
            勤怠履歴から自動反映 ／ 計算区切り: {diagnostics.roundingMinutes}分単位 ／ 勤怠あり{" "}
            {diagnostics.summary.employeesWithAttendance}名
            {diagnostics.summary.totalExcludedRecords > 0 &&
              ` ／ 給与対象外 ${diagnostics.summary.totalExcludedRecords}件`}
            {diagnostics.summary.totalOpenShifts > 0 && ` ／ 退勤未打刻 ${diagnostics.summary.totalOpenShifts}件`}
          </p>
          {diagnostics.items.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm text-amber-900">
              {diagnostics.items.map((item) => (
                <li key={item.employeeId} className="rounded-xl bg-white/70 px-3 py-2">
                  <span className="font-medium">{item.employeeName}</span>
                  <span className="text-amber-700">（{item.employeeCode}）</span>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-800">
                    {item.issues.map((issue) => (
                      <li key={`${item.employeeId}-${issue}`}>{issue}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : diagnostics.summary.employeesWithAttendance > 0 ? (
            <p className="mt-2 text-sm text-emerald-700">
              問題は検出されませんでした。表示が古い場合は「給与を計算」を実行してください。
            </p>
          ) : (
            <p className="mt-2 text-sm text-amber-800">この月の勤怠記録がありません。</p>
          )}
        </div>
      )}

      {/* サマリーカード */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "対象人数", value: `${summary.count}名` },
          { label: "総支給額", value: formatYen(summary.totalPay), highlight: "red" },
          { label: "総勤務時間", value: formatHoursClock(summary.totalHours) },
          { label: "通常勤務時間", value: formatHoursClock(summary.regularHours) },
          { label: "深夜勤務時間", value: formatHoursClock(summary.nightHours), highlight: "blue" },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{card.label}</p>
            <p
              className={`mt-1 text-lg font-bold ${
                card.highlight === "red"
                  ? "text-red-600"
                  : card.highlight === "blue"
                    ? "text-blue-600"
                    : "text-slate-900"
              }`}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* PC: テーブル */}
      <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
              <th className="px-5 py-3 font-medium">社員コード</th>
              <th className="px-5 py-3 font-medium">従業員名</th>
              <th className="px-5 py-3 font-medium">勤務日数</th>
              <th className="px-5 py-3 font-medium">給与計算時間</th>
              <th className="px-5 py-3 font-medium">通常勤務時間</th>
              <th className="px-5 py-3 font-medium">深夜勤務時間</th>
              <th className="px-5 py-3 font-medium">時給</th>
              <th className="px-5 py-3 font-medium">通常給与</th>
              <th className="px-5 py-3 font-medium">深夜手当</th>
              <th className="px-5 py-3 font-medium">総支給額</th>
            </tr>
          </thead>
          <tbody>
            {payroll.map((row) => (
              <tr key={row.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-4 font-mono text-xs">{row.employees?.employee_code ?? "—"}</td>
                <td className="px-5 py-4 font-medium">{row.employees?.name ?? "—"}</td>
                <td className="px-5 py-4">{row.attendance_days ?? 0}日</td>
                <td className="px-5 py-4 font-semibold text-emerald-600">{formatHoursClock(getPayrollHours(row))}</td>
                <td className="px-5 py-4">{formatHoursClock(Number(row.actual_regular_hours ?? row.regular_hours))}</td>
                <td className="px-5 py-4 font-medium text-blue-600">
                  {formatHoursClock(Number(row.actual_night_hours ?? row.night_hours))}
                </td>
                <td className="px-5 py-4">{formatYen(Number(row.employees?.hourly_rate ?? 0))}</td>
                <td className="px-5 py-4">{formatYen(Number(row.regular_pay))}</td>
                <td className="px-5 py-4">{formatYen(Number(row.night_pay))}</td>
                <td className="px-5 py-4 font-bold text-red-600">{formatYen(Number(row.total_pay))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {payroll.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-500">この月の給与データがありません。「給与を計算」を実行してください。</p>
        )}
      </div>

      {/* スマホ: カード */}
      <div className="space-y-4 md:hidden">
        {payroll.map((row) => (
          <div key={row.id} className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-lg font-bold text-slate-900">{row.employees?.name ?? "—"}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">勤務日数</dt>
                <dd>{row.attendance_days ?? 0}日</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">給与計算時間</dt>
                <dd className="font-semibold text-emerald-600">{formatHoursClock(getPayrollHours(row))}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">通常勤務時間</dt>
                <dd>{formatHoursClock(Number(row.actual_regular_hours ?? row.regular_hours))}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">深夜勤務時間</dt>
                <dd className="font-medium text-blue-600">
                  {formatHoursClock(Number(row.actual_night_hours ?? row.night_hours))}
                </dd>
              </div>
            </dl>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">総支給額</p>
              <p className="text-2xl font-bold text-red-600">{formatYen(Number(row.total_pay))}</p>
            </div>
          </div>
        ))}
        {payroll.length === 0 && (
          <p className="py-12 text-center text-sm text-slate-500">この月の給与データがありません。</p>
        )}
      </div>
    </div>
  );
}
