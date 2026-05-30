import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getCurrentMonthInJst, isLastDayOfMonthInJst } from "@/lib/payroll/calculate";
import { runMonthlyPayroll } from "@/lib/payroll/run-monthly";

export type MonthlyPayrollCronResult =
  | { skipped: true; message: string }
  | {
      success: true;
      year: number;
      month: number;
      processed: number;
      errors: string[];
    };

export async function executeMonthlyPayrollCron(): Promise<MonthlyPayrollCronResult> {
  if (!isLastDayOfMonthInJst()) {
    return {
      skipped: true,
      message: "月末以外のためスキップしました",
    };
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY が未設定です");
  }

  const supabase: SupabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey
  );

  const { year, month } = getCurrentMonthInJst();
  const result = await runMonthlyPayroll(supabase, year, month);

  return {
    success: true,
    year,
    month,
    ...result,
  };
}
