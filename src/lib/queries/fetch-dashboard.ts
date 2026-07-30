import { createClient } from "@/lib/supabase/client";
import { isAllStores } from "@/lib/stores/queries";
import { perfLog } from "@/lib/perf/dev-logger";

export type DashboardRecentRow = {
  clock_in: string;
  employees: { name: string; stores: { name: string } | null } | null;
};

export type DashboardQueryData = {
  employeeCount: number;
  openAttendance: number;
  recent: DashboardRecentRow[];
};

export async function fetchDashboardData(storeId: string): Promise<DashboardQueryData> {
  perfLog("query-start", { key: "dashboard", storeId });
  const started = performance.now();
  const supabase = createClient();

  let employeeQuery = supabase
    .from("employees")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  let attendanceQuery = supabase
    .from("attendance_records")
    .select("*", { count: "exact", head: true })
    .is("clock_out", null);

  let recentQuery = supabase
    .from("attendance_records")
    .select("clock_in, employees(name, stores(name))")
    .order("clock_in", { ascending: false })
    .limit(5);

  if (!isAllStores(storeId)) {
    employeeQuery = employeeQuery.eq("store_id", storeId);
    attendanceQuery = attendanceQuery.eq("store_id", storeId);
    recentQuery = recentQuery.eq("store_id", storeId);
  }

  const [{ count: employeeCount }, { count: openAttendance }, { data: recentRaw }] =
    await Promise.all([employeeQuery, attendanceQuery, recentQuery]);

  const recent: DashboardRecentRow[] = (recentRaw ?? []).map((row) => {
    const rawEmp = row.employees as unknown;
    const emp = (Array.isArray(rawEmp) ? rawEmp[0] : rawEmp) as
      | { name: string; stores: { name: string } | { name: string }[] | null }
      | null
      | undefined;
    const store = emp?.stores;
    const storeObj = Array.isArray(store) ? (store[0] ?? null) : store;
    return {
      clock_in: row.clock_in as string,
      employees: emp
        ? { name: emp.name, stores: storeObj ? { name: storeObj.name } : null }
        : null,
    };
  });

  perfLog("query-complete", {
    key: "dashboard",
    ms: Math.round(performance.now() - started),
    storeId,
  });

  return {
    employeeCount: employeeCount ?? 0,
    openAttendance: openAttendance ?? 0,
    recent,
  };
}
