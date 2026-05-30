import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { DashboardContent } from "@/components/admin/DashboardContent";
import { fetchActiveStores, isAllStores } from "@/lib/stores/queries";
import { ALL_STORES_VALUE } from "@/lib/stores/constants";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}) {
  const params = await searchParams;
  const storeId = params.store ?? ALL_STORES_VALUE;
  const supabase = await createClient();
  const stores = await fetchActiveStores(supabase);

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

  const [
    { count: employeeCount },
    { count: openAttendance },
    { data: recent },
  ] = await Promise.all([employeeQuery, attendanceQuery, recentQuery]);

  return (
    <Suspense fallback={<p className="text-sm text-slate-500">読み込み中…</p>}>
      <DashboardContent
        stores={stores}
        employeeCount={employeeCount ?? 0}
        openAttendance={openAttendance ?? 0}
        recent={recent ?? []}
      />
    </Suspense>
  );
}
