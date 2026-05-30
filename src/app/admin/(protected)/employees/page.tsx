import { createClient } from "@/lib/supabase/server";
import { EmployeeManager } from "@/components/admin/EmployeeManager";
import { fetchActiveStores } from "@/lib/stores/queries";
import type { EmployeeWithStore } from "@/types/database";

export default async function EmployeesPage() {
  const supabase = await createClient();
  const [{ data: allStores }, { data }] = await Promise.all([
    supabase.from("stores").select("id, name, is_active").order("name"),
    supabase
      .from("employees")
      .select("*, stores(id, name)")
      .order("created_at", { ascending: false }),
  ]);
  const stores = allStores ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">従業員一覧</h2>
        <p className="text-sm text-slate-600">所属店舗・時給の設定と顔認証の登録</p>
      </div>
      <EmployeeManager
        initialEmployees={(data as EmployeeWithStore[]) ?? []}
        stores={stores}
      />
    </div>
  );
}
