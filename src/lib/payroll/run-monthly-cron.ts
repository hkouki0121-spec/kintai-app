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
  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("id")
    .eq("is_active", true);

  if (companiesError) {
    throw new Error(companiesError.message);
  }

  let processed = 0;
  const errors: string[] = [];

  for (const company of companies ?? []) {
    const result = await runMonthlyPayroll(supabase, year, month, null, company.id);
    processed += result.processed;
    errors.push(...result.errors);
  }

  return {
    success: true,
    year,
    month,
    processed,
    errors,
  };
}
