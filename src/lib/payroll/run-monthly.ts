import type { SupabaseClient } from "@supabase/supabase-js";
import type { PayrollScope } from "@/lib/payroll/resolve-scope";
import { syncPayrollFromAttendance } from "@/lib/payroll/sync-from-attendance";

async function buildCronScope(
  supabase: SupabaseClient,
  companyId: string,
  storeId?: string | null
): Promise<PayrollScope> {
  const { data: stores } = await supabase
    .from("stores")
    .select("id, company_id")
    .eq("company_id", companyId)
    .eq("is_active", true);

  const accessibleStoreIds = (stores ?? []).map((store) => store.id);

  return {
    adminUserId: "cron",
    adminCompanyId: companyId,
    storeId: storeId ?? null,
    accessibleStoreIds,
    dataCompanyIds: [companyId],
  };
}

export async function runMonthlyPayroll(
  supabase: SupabaseClient,
  year: number,
  month: number,
  storeId?: string | null,
  companyId?: string | null
): Promise<{ processed: number; errors: string[] }> {
  if (!companyId) {
    return { processed: 0, errors: ["companyId が必要です"] };
  }

  const scope = await buildCronScope(supabase, companyId, storeId);
  const result = await syncPayrollFromAttendance(
    supabase,
    supabase,
    year,
    month,
    scope,
    "全店舗",
    "service"
  );
  return { processed: result.processed, errors: result.errors };
}
