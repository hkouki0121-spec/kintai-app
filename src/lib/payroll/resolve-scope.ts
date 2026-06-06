import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompanyContext } from "@/lib/auth/company-context";
import { isAllStores } from "@/lib/stores/queries";

export type PayrollScope = {
  adminUserId: string;
  adminCompanyId: string | null;
  storeId: string | null;
  accessibleStoreIds: string[];
  dataCompanyIds: string[];
};

/** 勤怠履歴と同じく、管理者がRLSで閲覧できる店舗からデータ範囲を決定 */
export async function resolvePayrollScope(
  authSupabase: SupabaseClient,
  context: CompanyContext,
  storeId?: string | null
): Promise<PayrollScope> {
  const { data: accessibleStores, error } = await authSupabase
    .from("stores")
    .select("id, company_id")
    .eq("is_active", true);

  if (error) {
    throw new Error(`店舗一覧の取得に失敗しました: ${error.message}`);
  }

  const stores = accessibleStores ?? [];
  const accessibleStoreIds = stores.map((store) => store.id);
  const dataCompanyIds = [
    ...new Set(stores.map((store) => store.company_id).filter(Boolean) as string[]),
  ];

  if (!isAllStores(storeId)) {
    const selected = stores.find((store) => store.id === storeId);
    if (!selected) {
      throw new Error("この店舗にアクセスする権限がありません");
    }
    return {
      adminUserId: context.userId,
      adminCompanyId: context.companyId,
      storeId: storeId!,
      accessibleStoreIds: [storeId!],
      dataCompanyIds: selected.company_id ? [selected.company_id] : dataCompanyIds,
    };
  }

  return {
    adminUserId: context.userId,
    adminCompanyId: context.companyId,
    storeId: null,
    accessibleStoreIds,
    dataCompanyIds:
      dataCompanyIds.length > 0
        ? dataCompanyIds
        : context.companyId
          ? [context.companyId]
          : [],
  };
}
