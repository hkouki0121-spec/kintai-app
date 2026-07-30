import { createClient } from "@/lib/supabase/client";
import { STORE_LIST_SELECT, type AdminStoreListItem } from "@/lib/stores/queries";
import { perfLog } from "@/lib/perf/dev-logger";

export async function fetchStoresForClient(): Promise<AdminStoreListItem[]> {
  perfLog("query-start", { key: "stores" });
  const started = performance.now();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stores")
    .select(STORE_LIST_SELECT)
    .order("name");
  if (error) throw error;
  perfLog("query-complete", {
    key: "stores",
    ms: Math.round(performance.now() - started),
    rows: data?.length ?? 0,
  });
  return data ?? [];
}
