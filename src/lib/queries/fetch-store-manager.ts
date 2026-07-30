import { createClient } from "@/lib/supabase/client";
import { STORE_MANAGER_SELECT } from "@/lib/stores/queries";
import type { Company, LineGroup, Store } from "@/types/database";
import { perfLog } from "@/lib/perf/dev-logger";

export type StoreManagerQueryData = {
  stores: Store[];
  groups: LineGroup[];
  companies: Pick<Company, "id" | "name">[];
};

export async function fetchStoreManagerData(
  isSuperAdmin: boolean
): Promise<StoreManagerQueryData> {
  perfLog("query-start", { key: "store-manager" });
  const started = performance.now();
  const supabase = createClient();

  const [{ data: stores }, { data: groups }, companiesResult] = await Promise.all([
    supabase.from("stores").select(STORE_MANAGER_SELECT).order("name"),
    supabase
      .from("line_groups")
      .select("id, company_id, group_id, group_name, last_seen_at, created_at")
      .order("last_seen_at", { ascending: false }),
    isSuperAdmin
      ? supabase.from("companies").select("id, name").eq("is_active", true).order("name")
      : Promise.resolve({ data: [] as Pick<Company, "id" | "name">[] }),
  ]);

  perfLog("query-complete", {
    key: "store-manager",
    ms: Math.round(performance.now() - started),
    rows: stores?.length ?? 0,
  });

  return {
    stores: (stores as Store[]) ?? [],
    groups: (groups as LineGroup[]) ?? [],
    companies: companiesResult.data ?? [],
  };
}
