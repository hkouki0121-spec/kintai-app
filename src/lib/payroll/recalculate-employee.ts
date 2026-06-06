import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { calculateEmployeePayroll } from "@/lib/payroll/calculate";
import { getJstMonthBounds } from "@/lib/payroll/jst-month";
import { getPayrollSettings } from "@/lib/payroll/settings";
import { TIMEZONE } from "@/lib/constants";

export function getAffectedPayrollMonths(
  ...dates: (string | null | undefined)[]
): { year: number; month: number }[] {
  const keys = new Set<string>();
  for (const value of dates) {
    if (!value) continue;
    const jst = toZonedTime(new Date(value), TIMEZONE);
    keys.add(`${jst.getFullYear()}-${jst.getMonth() + 1}`);
  }
  return [...keys].map((key) => {
    const [year, month] = key.split("-").map(Number);
    return { year, month };
  });
}

/** 1従業員・1ヶ月分の給与を勤怠から再計算して保存 */
export async function recalculateEmployeeMonthlyPayroll(
  supabase: SupabaseClient,
  employeeId: string,
  year: number,
  month: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: employee, error: empError } = await supabase
    .from("employees")
    .select("id, hourly_rate, company_id, is_active")
    .eq("id", employeeId)
    .maybeSingle();

  if (empError) return { ok: false, error: empError.message };
  if (!employee) return { ok: false, error: "従業員が見つかりません" };

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("payroll_rounding_minutes")
    .eq("id", employee.company_id)
    .maybeSingle();
  if (companyError) {
    console.warn("[payroll/recalculate] company settings unavailable", {
      employeeId,
      companyId: employee.company_id,
      message: companyError.message,
    });
  }

  const { start: monthStart, end: monthEnd } = getJstMonthBounds(year, month);

  const { data: records, error: attError } = await supabase
    .from("attendance_records")
    .select("clock_in, clock_out")
    .eq("employee_id", employeeId)
    .lt("clock_in", monthEnd.toISOString())
    .or(`clock_out.gt.${monthStart.toISOString()},clock_out.is.null`);

  if (attError) return { ok: false, error: attError.message };

  const settings = getPayrollSettings(company?.payroll_rounding_minutes);
  const result = calculateEmployeePayroll(
    employee.id,
    Number(employee.hourly_rate),
    records ?? [],
    year,
    month,
    settings
  );

  const { error: upsertError } = await supabase.from("monthly_payroll").upsert(
    {
      employee_id: result.employeeId,
      company_id: employee.company_id,
      year: result.year,
      month: result.month,
      attendance_days: result.attendanceDays,
      actual_regular_hours: result.actualRegularHours,
      actual_night_hours: result.actualNightHours,
      actual_total_hours: result.actualTotalHours,
      overtime_hours: result.overtimeHours,
      regular_hours: result.regularHours,
      night_hours: result.nightHours,
      regular_pay: result.regularPay,
      night_pay: result.nightPay,
      total_pay: result.totalPay,
      calculated_at: new Date().toISOString(),
    },
    { onConflict: "employee_id,year,month" }
  );

  if (upsertError) return { ok: false, error: upsertError.message };
  return { ok: true };
}

/** 勤怠の変更に伴い、影響する月の給与を自動更新 */
export async function syncEmployeePayrollAfterAttendance(
  supabase: SupabaseClient,
  employeeId: string,
  ...dates: (string | null | undefined)[]
): Promise<void> {
  const months = getAffectedPayrollMonths(...dates);
  if (months.length === 0) {
    const now = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
    months.push(...getAffectedPayrollMonths(now));
  }

  const unique = new Map(months.map((m) => [`${m.year}-${m.month}`, m]));
  for (const { year, month } of unique.values()) {
    const result = await recalculateEmployeeMonthlyPayroll(supabase, employeeId, year, month);
    if (!result.ok) {
      console.error("[payroll/sync]", { employeeId, year, month, error: result.error });
    }
  }
}
