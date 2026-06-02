"use client";

import { fromZonedTime } from "date-fns-tz";
import { useState } from "react";
import type { EmployeeWithStore } from "@/types/database";
import { TIMEZONE } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";

type Props = {
  employees: EmployeeWithStore[];
  onClose: () => void;
  onSaved: () => void;
};

type ApiErrorPayload = {
  error?: string;
  message?: string;
  code?: string | null;
  details?: string | null;
  denialStep?: string | null;
  debug?: Record<string, unknown>;
};

function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  return fromZonedTime(value, TIMEZONE).toISOString();
}

function formatApiError(data: ApiErrorPayload): string {
  const lines = [
    data.error ?? data.message ?? "登録に失敗しました",
    data.denialStep ? `判定箇所: ${data.denialStep}` : null,
    data.message && data.message !== data.error ? `message: ${data.message}` : null,
    data.code ? `code: ${data.code}` : null,
    data.details ? `details: ${data.details}` : null,
  ];

  if (data.debug) {
    lines.push(`debug: ${JSON.stringify(data.debug, null, 2)}`);
  }

  return lines.filter(Boolean).join("\n");
}

export function AttendanceManualCreateModal({ employees, onClose, onSaved }: Props) {
  const [employeeId, setEmployeeId] = useState("");
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeEmployees = employees.filter((e) => e.is_active);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!employeeId) {
      setError("従業員を選択してください");
      return;
    }
    if (!clockIn) {
      setError("出勤時刻を入力してください");
      return;
    }
    if (!reason.trim()) {
      setError("修正理由を入力してください");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          clockIn: fromDatetimeLocalValue(clockIn),
          clockOut: clockOut ? fromDatetimeLocalValue(clockOut) : null,
          reason: reason.trim(),
        }),
      });

      const data = (await res.json()) as ApiErrorPayload;
      if (!res.ok) {
        setError(formatApiError(data));
        return;
      }

      onSaved();
    } catch {
      setError("登録に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">勤怠を手動登録</h3>
            <p className="mt-1 text-sm text-slate-600">出勤打刻忘れなど、記録がない場合に使用します</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            閉じる
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-600">従業員</label>
            <select
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
            >
              <option value="">選択してください</option>
              {activeEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}（{emp.stores?.name ?? "—"}）
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">出勤時刻</label>
            <Input
              type="datetime-local"
              value={clockIn}
              onChange={(e) => setClockIn(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">退勤時刻（任意）</label>
            <Input
              type="datetime-local"
              value={clockOut}
              onChange={(e) => setClockOut(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">修正理由</label>
            <textarea
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例: 出勤打刻を忘れたため手動登録"
              required
            />
          </div>

          {error && (
            <Alert type="error">
              <pre className="whitespace-pre-wrap break-words text-sm">{error}</pre>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose} fullWidth>
              キャンセル
            </Button>
            <Button type="submit" disabled={saving} fullWidth>
              {saving ? "保存中…" : "登録する"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
