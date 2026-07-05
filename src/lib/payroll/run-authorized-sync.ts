import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompanyContext } from "@/lib/auth/company-context";
import { fetchPayrollForPeriod } from "@/lib/payroll/fetch-payroll";
import { resolvePayrollScope } from "@/lib/payroll/resolve-scope";
import {
  syncPayrollFromAttendance,
  type PayrollSyncResult,
} from "@/lib/payroll/sync-from-attendance";
import { createServiceClient } from "@/lib/supabase/service";

/** 給与一覧の読み取りのみ（再計算なし） */
export async function runAuthorizedPayrollFetch(
  authSupabase: SupabaseClient,
  context: CompanyContext,
  year: number,
  month: number,
  storeId?: string | null
) {
  const scope = await resolvePayrollScope(authSupabase, context, storeId);
  const serviceSupabase = createServiceClient();
  const payroll = await fetchPayrollForPeriod(
    authSupabase,
    serviceSupabase,
    year,
    month,
    scope
  );
  return { payroll, scope };
}

/** 認可確認後、RLSで勤怠を読み取り service role で給与を書き込み */
export async function runAuthorizedPayrollSync(
  authSupabase: SupabaseClient,
  context: CompanyContext,
  year: number,
  month: number,
  storeId?: string | null,
  storeLabel = "全店舗",
  scope?: Awaited<ReturnType<typeof resolvePayrollScope>>
): Promise<PayrollSyncResult> {
  const resolvedScope = scope ?? (await resolvePayrollScope(authSupabase, context, storeId));
  const serviceSupabase = createServiceClient();
  return syncPayrollFromAttendance(
    authSupabase,
    serviceSupabase,
    year,
    month,
    resolvedScope,
    storeLabel,
    "rls"
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
  const scope = await resolvePayrollScope(authSupabase, context, storeId);
  const result = await runAuthorizedPayrollSync(
    authSupabase,
    context,
    year,
    month,
    storeId,
    storeLabel,
    scope
  );
  const serviceSupabase = createServiceClient();
  const payroll = await fetchPayrollForPeriod(
    authSupabase,
    serviceSupabase,
    year,
    month,
    scope
  );
  return { result, payroll, scope };
}
