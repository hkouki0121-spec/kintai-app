import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompanyContext } from "@/lib/auth/company-context";
import { fetchPayrollForPeriod } from "@/lib/payroll/fetch-payroll";
import {
  syncPayrollFromAttendance,
  type PayrollSyncResult,
} from "@/lib/payroll/sync-from-attendance";
import { createServiceClient } from "@/lib/supabase/service";
import { isAllStores } from "@/lib/stores/queries";

async function assertStoreAccess(
  authSupabase: SupabaseClient,
  storeId: string | null | undefined,
  companyId: string | null
) {
  if (isAllStores(storeId)) return;

  const { data: store, error } = await authSupabase
    .from("stores")
    .select("id, company_id")
    .eq("id", storeId!)
    .maybeSingle();

  if (error || !store) {
    throw new Error("店舗が見つかりません");
  }
  if (companyId && store.company_id !== companyId) {
    throw new Error("この店舗にアクセスする権限がありません");
  }
}

/** 認可確認後、service role で勤怠から給与を再計算 */
export async function runAuthorizedPayrollSync(
  authSupabase: SupabaseClient,
  context: CompanyContext,
  year: number,
  month: number,
  storeId?: string | null,
  storeLabel = "全店舗"
): Promise<PayrollSyncResult> {
  const companyId = context.isSuperAdmin ? null : context.companyId;
  await assertStoreAccess(authSupabase, storeId, companyId);

  const serviceSupabase = createServiceClient();
  return syncPayrollFromAttendance(
    serviceSupabase,
    year,
    month,
    storeId,
    companyId,
    storeLabel
  );
}

export async function runAuthorizedPayrollSyncAndFetch(
  authSupabase: SupabaseClient,
  context: CompanyContext,
  year: number,
  month: number,
  storeId?: string | null,
  storeLabel = "全店舗"
) {
  const companyId = context.isSuperAdmin ? null : context.companyId;
  const result = await runAuthorizedPayrollSync(
    authSupabase,
    context,
    year,
    month,
    storeId,
    storeLabel
  );
  const serviceSupabase = createServiceClient();
  const payroll = await fetchPayrollForPeriod(
    serviceSupabase,
    year,
    month,
    storeId,
    companyId
  );
  return { result, payroll };
}
