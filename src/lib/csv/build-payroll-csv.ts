export type PayrollCsvRow = {
  companyName: string;
  storeName: string;
  year: number;
  month: number;
  employeeCode: string;
  employeeName: string;
  attendanceDays: number;
  actualTotalHours: number;
  payrollTotalHours: number;
  payrollRegularHours: number;
  payrollNightHours: number;
  overtimeHours: number;
  hourlyRate: number;
  regularPay: number;
  nightPay: number;
  overtimePay: number;
  totalPay: number;
};

function escapeCsv(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatCsvHours(hours: number): string {
  return hours.toFixed(2);
}

function formatCsvYen(amount: number): string {
  return String(Math.trunc(amount));
}

const CSV_HEADERS = [
  "会社名",
  "店舗名",
  "対象年月",
  "社員コード",
  "従業員名",
  "勤務日数",
  "実勤務時間",
  "給与計算時間",
  "通常勤務時間",
  "深夜勤務時間",
  "残業時間",
  "時給",
  "通常給与",
  "深夜手当",
  "残業手当",
  "総支給額",
] as const;

export function buildPayrollCsvContent(rows: PayrollCsvRow[]): string {
  if (rows.length === 0) {
    throw new Error("出力する給与データがありません");
  }

  const body = rows.map((row) => {
    const targetMonth = `${row.year}年${row.month}月`;
    return [
      row.companyName,
      row.storeName,
      targetMonth,
      row.employeeCode,
      row.employeeName,
      row.attendanceDays,
      formatCsvHours(row.actualTotalHours),
      formatCsvHours(row.payrollTotalHours),
      formatCsvHours(row.payrollRegularHours),
      formatCsvHours(row.payrollNightHours),
      formatCsvHours(row.overtimeHours),
      formatCsvYen(row.hourlyRate),
      formatCsvYen(row.regularPay),
      formatCsvYen(row.nightPay),
      formatCsvYen(row.overtimePay),
      formatCsvYen(row.totalPay),
    ]
      .map(escapeCsv)
      .join(",");
  });

  const bom = "\uFEFF";
  return bom + [CSV_HEADERS.map(escapeCsv).join(","), ...body].join("\n");
}

/** ファイル名用に店舗名などをサニタイズ */
export function sanitizePayrollCsvFilenamePart(name: string): string {
  return name.replace(/\s+/g, "").replace(/[\\/:*?"<>|]/g, "");
}

export function buildPayrollCsvFilename(
  year: number,
  month: number,
  storeLabel: string
): string {
  const monthPart = `${year}-${String(month).padStart(2, "0")}`;
  const storePart = sanitizePayrollCsvFilenamePart(storeLabel);
  return `payroll_${monthPart}_${storePart}.csv`;
}
