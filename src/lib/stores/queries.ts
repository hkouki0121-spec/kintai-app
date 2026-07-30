import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { ALL_STORES_VALUE } from "@/lib/stores/constants";
import type { Store } from "@/types/database";

export const STORE_LIST_SELECT = "id, name, is_active, company_id" as const;

export type AdminStoreListItem = Pick<Store, "id" | "name" | "is_active" | "company_id">;

export const STORE_MANAGER_SELECT =
  "id, company_id, name, address, phone, manager_name, line_user_id, line_group_id, line_notify_enabled, is_active, qr_token_hash, qr_token_updated_at, created_at" as const;

export const fetchAdminStoreList = cache(
  async (supabase: SupabaseClient): Promise<AdminStoreListItem[]> => {
    const { data } = await supabase
      .from("stores")
      .select(STORE_LIST_SELECT)
      .order("name");
    return data ?? [];
  }
);

export const fetchActiveStores = cache(
  async (supabase: SupabaseClient): Promise<Pick<Store, "id" | "name">[]> => {
    const { data } = await supabase
      .from("stores")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    return data ?? [];
  }
);

export function isAllStores(storeId: string | undefined | null): boolean {
  return !storeId || storeId === ALL_STORES_VALUE;
}
