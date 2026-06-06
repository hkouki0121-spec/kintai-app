function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** 勤怠履歴と同じ clock_in 基準の月範囲（JST・半開区間） */
export function getPayrollMonthRange(year: number, month: number): {
  dateFrom: string;
  dateTo: string;
  year: number;
  month: number;
} {
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    dateFrom: `${year}-${pad(month)}-01T00:00:00+09:00`,
    dateTo: `${nextYear}-${pad(nextMonth)}-01T00:00:00+09:00`,
    year,
    month,
  };
}
