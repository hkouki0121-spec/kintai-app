"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { runMonthlyPayroll } from "@/lib/payroll/run-monthly";
import { downloadPayrollPdf } from "@/lib/pdf/generate-payroll-pdf";
import type { PayrollWithEmployee } from "@/types/database";
import { formatYen } from "@/lib/format";
import { HoursDisplay } from "@/components/admin/HoursDisplay";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";

type Props = {
  initialPayroll: PayrollWithEmployee[];
  initialYear: number;
  initialMonth: number;
};

export function PayrollManager({ initialPayroll, initialYear, initialMonth }: Props) {
  const [year, setYear] = useState(String(initialYear));
  const [month, setMonth] = useState(String(initialMonth));
  const [payroll, setPayroll] = useState(initialPayroll);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const loadPayroll = async (y: number, m: number) => {
    const { data } = await supabase
      .from("monthly_payroll")
      .select("*, employees(id, name, employee_code)")
      .eq("year", y)
      .eq("month", m)
      .order("total_pay", { ascending: false });
    setPayroll((data as PayrollWithEmployee[]) ?? []);
  };

  const handlePeriodChange = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/admin/payroll?year=${year}&month=${month}`);
    loadPayroll(Number(year), Number(month));
  };

  const handleCalculate = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const y = Number(year);
      const m = Number(month);
      const result = await runMonthlyPayroll(supabase, y, m);
      await loadPayroll(y, m);
      if (result.errors.length > 0) {
        setMessage({
          type: "error",
          text: `${result.processed}件を計算しましたが、一部エラー: ${result.errors.join(", ")}`,
        });
      } else {
        setMessage({
          type: "success",
          text: `${y}年${m}月の給与を${result.processed}名分計算しました`,
        });
      }
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = payroll.reduce((sum, p) => sum + Number(p.total_pay), 0);

  const handleDownloadPdf = async () => {
    if (payroll.length === 0) {
      setMessage({ type: "error", text: "給与データがありません。先に給与を計算してください。" });
      return;
    }
    setPdfLoading(true);
    setMessage(null);
    try {
      await downloadPayrollPdf(payroll, Number(year), Number(month));
      setMessage({ type: "success", text: "給与明細PDFをダウンロードしました。" });
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message });
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={handlePeriodChange} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm text-slate-600">年</label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-28"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">月</label>
            <Input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-20"
            />
          </div>
          <Button type="submit" variant="secondary">
            表示
          </Button>
          <Button type="button" onClick={handleCalculate} disabled={loading}>
            {loading ? "計算中…" : "給与を計算"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleDownloadPdf}
            disabled={pdfLoading || payroll.length === 0}
          >
            {pdfLoading ? "PDF作成中…" : "給与明細PDFを出力"}
          </Button>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          「給与を計算」で選択月の勤怠から自動集計します（退勤未記録は除外）。
          15分未満の勤務区間は0時間、以降は30分単位で切り捨て（0.5時間刻み）して給与に反映します。
        </p>
      </Card>

      {message && <Alert type={message.type}>{message.text}</Alert>}

      <Card>
        <p className="text-sm text-slate-500">合計支給額</p>
        <p className="text-2xl font-bold text-slate-900">{formatYen(totalAmount)}</p>
      </Card>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">従業員</th>
              <th className="min-w-[8rem] px-4 py-3 font-medium">通常勤務</th>
              <th className="min-w-[8rem] px-4 py-3 font-medium">深夜(22時〜)</th>
              <th className="px-4 py-3 font-medium">通常給</th>
              <th className="px-4 py-3 font-medium">深夜給</th>
              <th className="px-4 py-3 font-medium">合計</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payroll.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-medium">{row.employees?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <HoursDisplay
                    actualHours={Number(row.actual_regular_hours ?? row.regular_hours)}
                    payrollHours={Number(row.regular_hours)}
                  />
                </td>
                <td className="px-4 py-3">
                  <HoursDisplay
                    actualHours={Number(row.actual_night_hours ?? row.night_hours)}
                    payrollHours={Number(row.night_hours)}
                  />
                </td>
                <td className="px-4 py-3">{formatYen(Number(row.regular_pay))}</td>
                <td className="px-4 py-3">{formatYen(Number(row.night_pay))}</td>
                <td className="px-4 py-3 font-semibold">{formatYen(Number(row.total_pay))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {payroll.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">
            この月の給与データがありません。「給与を計算」を実行してください。
          </p>
        )}
      </div>
    </div>
  );
}
