"use client";

import { formatInTimeZone } from "date-fns-tz";
import { fromZonedTime } from "date-fns-tz";
import { useEffect, useState } from "react";
import type { AttendanceCorrection, EmployeeWithAttendance } from "@/types/database";
import { TIMEZONE } from "@/lib/constants";
import { formatJstDateTime } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { AttendanceCorrectionHistory } from "@/components/admin/AttendanceCorrectionHistory";

type Props = {
  record: EmployeeWithAttendance;
  onClose: () => void;
  onSaved: () => void;
};

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  return formatInTimeZone(new Date(iso), TIMEZONE, "yyyy-MM-dd'T'HH:mm");
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  return fromZonedTime(value, TIMEZONE).toISOString();
}

export function AttendanceEditModal({ record, onClose, onSaved }: Props) {
  const [clockIn, setClockIn] = useState(toDatetimeLocalValue(record.clock_in));
  const [clockOut, setClockOut] = useState(toDatetimeLocalValue(record.clock_out));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const res = await fetch(`/api/admin/attendance/${record.id}/corrections`);
        const data = (await res.json()) as {
          corrections?: AttendanceCorrection[];
          error?: string;
        };
        if (!cancelled && res.ok) {
          setCorrections(data.corrections ?? []);
        }
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    };

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [record.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!reason.trim()) {
      setError("修正理由を入力してください");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/attendance/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clockIn: fromDatetimeLocalValue(clockIn),
          clockOut: clockOut ? fromDatetimeLocalValue(clockOut) : null,
          reason: reason.trim(),
        }),
      });

      const data = (await res.json()) as { error?: string; correction?: AttendanceCorrection };
      if (!res.ok) {
        setError(data.error ?? "修正に失敗しました");
        return;
      }

      if (data.correction) {
        setCorrections((prev) => [data.correction!, ...prev]);
      }
      setReason("");
      onSaved();
    } catch {
      setError("修正に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">勤怠修正</h3>
            <p className="mt-1 text-sm text-slate-600">
              {record.employees?.name ?? "—"} / {record.employees?.stores?.name ?? "—"}
            </p>
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
            <label className="mb-1 block text-sm text-slate-600">出勤時刻</label>
            <Input
              type="datetime-local"
              value={clockIn}
              onChange={(e) => setClockIn(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-slate-500">現在: {formatJstDateTime(record.clock_in)}</p>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">退勤時刻</label>
            <Input
              type="datetime-local"
              value={clockOut}
              onChange={(e) => setClockOut(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">
              現在: {record.clock_out ? formatJstDateTime(record.clock_out) : "未退勤"}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-600">修正理由</label>
            <textarea
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="修正理由を入力してください"
              required
            />
          </div>

          {error && <Alert type="error">{error}</Alert>}

          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose} fullWidth>
              キャンセル
            </Button>
            <Button type="submit" disabled={saving} fullWidth>
              {saving ? "保存中…" : "修正を保存"}
            </Button>
          </div>
        </form>

        <div className="mt-6 border-t border-slate-100 pt-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-900">修正履歴</h4>
          {loadingHistory ? (
            <p className="text-sm text-slate-500">読み込み中…</p>
          ) : (
            <AttendanceCorrectionHistory corrections={corrections} />
          )}
        </div>
      </div>
    </div>
  );
}
