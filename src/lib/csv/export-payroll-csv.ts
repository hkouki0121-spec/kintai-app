import { formatActualHours, formatYen } from "@/lib/format";
import type { PayrollWithEmployee } from "@/types/database";

function escapeCsv(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function getTotalHours(row: PayrollWithEmployee): number {
  if (row.actual_total_hours != null) {
    return Number(row.actual_total_hours);
  }
  return Number(row.actual_regular_hours ?? row.regular_hours) + Number(row.actual_night_hours ?? row.night_hours);
}

/** 給与一覧をCSVでダウンロード */
export function downloadPayrollCsv(
  payroll: PayrollWithEmployee[],
  year: number,
  month: number
): void {
  if (payroll.length === 0) {
    throw new Error("出力する給与データがありません");
  }

  const headers = [
    "対象年",
    "対象月",
    "従業員名",
    "従業員コード",
    "店舗名",
    "出勤日数",
    "総勤務時間",
    "通常勤務時間",
    "深夜勤務時間",
    "残業時間",
    "通常給",
    "深夜給",
    "合計支給額",
  ];

  const rows = payroll.map((row) => {
    const actualRegular = Number(row.actual_regular_hours ?? row.regular_hours);
    const actualNight = Number(row.actual_night_hours ?? row.night_hours);
    return [
      year,
      month,
      row.employees?.name ?? "",
      row.employees?.employee_code ?? "",
      row.employees?.stores?.name ?? "",
      row.attendance_days ?? 0,
      formatActualHours(getTotalHours(row)),
      formatActualHours(actualRegular),
      formatActualHours(actualNight),
      formatActualHours(Number(row.overtime_hours ?? 0)),
      formatYen(Number(row.regular_pay)),
      formatYen(Number(row.night_pay)),
      formatYen(Number(row.total_pay)),
    ].map(escapeCsv);
  });

  const bom = "\uFEFF";
  const csv = [headers.map(escapeCsv).join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `給与一覧_${year}年${month}月.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
