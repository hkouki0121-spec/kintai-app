import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { COMPANY_NAME } from "@/lib/constants";
import { formatActualHours, formatPayrollHours, formatYen } from "@/lib/format";
import type { PayrollWithEmployee } from "@/types/database";

function buildPayslipHtml(row: PayrollWithEmployee, year: number, month: number): string {
  const name = row.employees?.name ?? "—";
  const actualRegular = Number(row.actual_regular_hours ?? 0);
  const actualNight = Number(row.actual_night_hours ?? 0);
  const payrollRegular = Number(row.regular_hours);
  const payrollNight = Number(row.night_hours);
  const actualTotal = actualRegular + actualNight;
  const payrollTotal = payrollRegular + payrollNight;

  return `
    <div style="width:720px;padding:32px 40px;font-family:'Hiragino Sans','Yu Gothic','Meiryo',sans-serif;color:#0f172a;font-size:14px;line-height:1.6;background:#fff;">
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;text-align:center;">給与明細</h1>
      <p style="margin:0 0 24px;text-align:center;font-size:16px;font-weight:600;">${COMPANY_NAME}</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;width:40%;">対象年月</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600;">${year}年${month}月</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">従業員名</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600;">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">実勤務時間</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">${formatActualHours(actualTotal)}（通常 ${formatActualHours(actualRegular)} / 深夜 ${formatActualHours(actualNight)}）</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">給与計算時間</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600;">${formatPayrollHours(payrollTotal)}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">通常勤務時間</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">${formatPayrollHours(payrollRegular)}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">深夜勤務時間</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">${formatPayrollHours(payrollNight)}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">通常給</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">${formatYen(Number(row.regular_pay))}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">深夜給</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">${formatYen(Number(row.night_pay))}</td></tr>
        <tr><td style="padding:12px 0;color:#64748b;font-size:15px;">合計支給額</td><td style="padding:12px 0;font-size:18px;font-weight:700;">${formatYen(Number(row.total_pay))}</td></tr>
      </table>
      <p style="margin:0;font-size:12px;color:#64748b;">備考：勤務時間は30分単位切り捨て、22時以降は深夜手当1.25倍</p>
    </div>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 給与明細PDFをブラウザでダウンロード（従業員ごとに1ページ） */
export async function downloadPayrollPdf(
  payroll: PayrollWithEmployee[],
  year: number,
  month: number
): Promise<void> {
  if (payroll.length === 0) {
    throw new Error("出力する給与データがありません");
  }

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const offscreen = document.createElement("div");
  offscreen.style.position = "fixed";
  offscreen.style.left = "-10000px";
  offscreen.style.top = "0";
  document.body.appendChild(offscreen);

  try {
    for (let i = 0; i < payroll.length; i++) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = buildPayslipHtml(payroll[i], year, month);
      offscreen.appendChild(wrapper);

      const canvas = await html2canvas(wrapper.firstElementChild as HTMLElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pageWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      const height = Math.min(imgHeight, pageHeight);

      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, 0, pageWidth, height);
      offscreen.removeChild(wrapper);
    }

    pdf.save(`給与明細_${year}年${month}月.pdf`);
  } finally {
    document.body.removeChild(offscreen);
  }
}
