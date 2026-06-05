import { ALL_STORES_VALUE } from "@/lib/stores/constants";
import { isAllStores } from "@/lib/stores/queries";
import type { PayrollWithEmployee } from "@/types/database";
import {
  buildPayrollCsvContent,
  type PayrollCsvRow,
} from "@/lib/csv/build-payroll-csv";

function getActualTotalHours(row: PayrollWithEmployee): number {
  if (row.actual_total_hours != null) {
    return Number(row.actual_total_hours);
  }
  return (
    Number(row.actual_regular_hours ?? row.regular_hours) +
    Number(row.actual_night_hours ?? row.night_hours)
  );
}

export function payrollRowsToCsvRows(
  payroll: PayrollWithEmployee[],
  companyName: string
): PayrollCsvRow[] {
  return payroll.map((row) => {
    const payrollRegularHours = Number(row.regular_hours);
    const payrollNightHours = Number(row.night_hours);
    const regularPay = Number(row.regular_pay);
    const nightPay = Number(row.night_pay);
    const totalPay = Number(row.total_pay);
    const overtimePay = Math.max(0, totalPay - regularPay - nightPay);

    return {
      companyName,
      storeName: row.employees?.stores?.name ?? "",
      year: row.year,
      month: row.month,
      employeeCode: row.employees?.employee_code ?? "",
      employeeName: row.employees?.name ?? "",
      attendanceDays: row.attendance_days ?? 0,
      actualTotalHours: getActualTotalHours(row),
      payrollTotalHours: payrollRegularHours + payrollNightHours,
      payrollRegularHours,
      payrollNightHours,
      overtimeHours: Number(row.overtime_hours ?? 0),
      hourlyRate: Number(row.employees?.hourly_rate ?? 0),
      regularPay,
      nightPay,
      overtimePay,
      totalPay,
    };
  });
}

export function buildPayrollCsvFromRecords(
  payroll: PayrollWithEmployee[],
  companyName: string
): string {
  return buildPayrollCsvContent(payrollRowsToCsvRows(payroll, companyName));
}

export type PayrollCsvQueryParams = {
  storeId: string;
  year: number;
  month: number;
};

export function parsePayrollCsvQueryParams(
  searchParams: URLSearchParams
): PayrollCsvQueryParams | null {
  const storeId = searchParams.get("storeId")?.trim();
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));

  if (
    !storeId ||
    !Number.isInteger(year) ||
    year < 2000 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  return { storeId, year, month };
}

export { ALL_STORES_VALUE, isAllStores };
