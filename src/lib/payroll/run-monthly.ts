import type { SupabaseClient } from "@supabase/supabase-js";
import { endOfMonth, startOfMonth } from "date-fns";
import { calculateEmployeePayroll } from "@/lib/payroll/calculate";

export async function runMonthlyPayroll(
  supabase: SupabaseClient,
  year: number,
  month: number
): Promise<{ processed: number; errors: string[] }> {
  const monthStart = startOfMonth(new Date(year, month - 1, 1)).toISOString();
  const monthEnd = endOfMonth(new Date(year, month - 1, 1)).toISOString();

  const { data: employees, error: empError } = await supabase
    .from("employees")
    .select("id, hourly_rate")
    .eq("is_active", true);

  if (empError) throw empError;

  const errors: string[] = [];
  let processed = 0;

  for (const emp of employees ?? []) {
    const { data: records, error: attError } = await supabase
      .from("attendance_records")
      .select("clock_in, clock_out")
      .eq("employee_id", emp.id)
      .gte("clock_in", monthStart)
      .lte("clock_in", monthEnd);

    if (attError) {
      errors.push(`${emp.id}: ${attError.message}`);
      continue;
    }

    const result = calculateEmployeePayroll(
      emp.id,
      Number(emp.hourly_rate),
      records ?? [],
      year,
      month
    );

    const { error: upsertError } = await supabase.from("monthly_payroll").upsert(
      {
        employee_id: result.employeeId,
        year: result.year,
        month: result.month,
        regular_hours: result.regularHours,
        night_hours: result.nightHours,
        regular_pay: result.regularPay,
        night_pay: result.nightPay,
        total_pay: result.totalPay,
        calculated_at: new Date().toISOString(),
      },
      { onConflict: "employee_id,year,month" }
    );

    if (upsertError) {
      errors.push(`${emp.id}: ${upsertError.message}`);
    } else {
      processed += 1;
    }
  }

  return { processed, errors };
}
