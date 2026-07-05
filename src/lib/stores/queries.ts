import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { ALL_STORES_VALUE } from "@/lib/stores/constants";
import type { Store } from "@/types/database";

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
