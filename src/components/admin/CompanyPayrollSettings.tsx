"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { PAYROLL_ROUNDING_OPTIONS, type PayrollRoundingMinutes } from "@/lib/payroll/settings";

export function CompanyPayrollSettings() {
  const [rounding, setRounding] = useState<PayrollRoundingMinutes>(30);
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/company-settings");
        const data = await res.json();
        if (res.ok) {
          setRounding(data.company.payrollRoundingMinutes);
          setCompanyName(data.company.name);
        } else {
          setMessage(data.error ?? "設定の取得に失敗しました");
        }
      } catch {
        setMessage("設定の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/company-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payrollRoundingMinutes: rounding }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "保存に失敗しました");
        return;
      }
      setMessage("給与計算の区切りを保存しました。給与一覧で「再計算」を実行してください。");
    } catch {
      setMessage("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Card><p className="text-sm text-slate-500">読み込み中…</p></Card>;
  }

  return (
    <Card>
      <h3 className="text-lg font-bold text-slate-900">給与計算の設定</h3>
      {companyName && <p className="mt-1 text-sm text-slate-500">{companyName}</p>}
      <p className="mt-3 text-sm text-slate-600">
        勤務時間を給与に反映する際の切り捨て単位を選択します。設定変更後は給与一覧で再計算が必要です。
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {PAYROLL_ROUNDING_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setRounding(opt.value)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              rounding === opt.value
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "保存中…" : "保存"}
        </Button>
      </div>
      {message && (
        <div className="mt-3">
          <Alert type={message.includes("保存") ? "success" : "error"}>{message}</Alert>
        </div>
      )}
    </Card>
  );
}
