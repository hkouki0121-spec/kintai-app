import { createClient } from "@/lib/supabase/server";
import { PayrollManager } from "@/components/admin/PayrollManager";
import { getCompanyContext } from "@/lib/auth/company-context";
import { runAuthorizedPayrollSyncAndFetch } from "@/lib/payroll/run-authorized-sync";
import { fetchActiveStores, isAllStores } from "@/lib/stores/queries";
import { ALL_STORES_VALUE } from "@/lib/stores/constants";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; store?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;
  const storeId = params.store ?? ALL_STORES_VALUE;

  const supabase = await createClient();
  const context = await getCompanyContext(supabase);
  const stores = await fetchActiveStores(supabase);

  let storeLabel = "全店舗";
  if (!isAllStores(storeId)) {
    const matched = stores.find((store) => store.id === storeId);
    storeLabel = matched?.name ?? storeId;
  }

  let payroll: Awaited<ReturnType<typeof runAuthorizedPayrollSyncAndFetch>>["payroll"] = [];
  if (context) {
    try {
      const synced = await runAuthorizedPayrollSyncAndFetch(
        supabase,
        context,
        year,
        month,
        isAllStores(storeId) ? null : storeId,
        storeLabel
      );
      payroll = synced.payroll;
    } catch (error) {
      console.error("[payroll/page] sync failed", error);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">給与一覧</h2>
        <p className="mt-1 text-sm text-slate-500">月次給与の確認・再計算・CSV出力</p>
      </div>
      <PayrollManager
        stores={stores}
        initialStoreId={storeId}
        initialPayroll={payroll}
        initialYear={year}
        initialMonth={month}
      />
    </div>
  );
}
