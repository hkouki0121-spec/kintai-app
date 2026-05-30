import { createClient } from "@/lib/supabase/server";
import { EmployeeManager } from "@/components/admin/EmployeeManager";
import type { Employee } from "@/types/database";

export default async function EmployeesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("employees")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">従業員一覧</h2>
        <p className="text-sm text-slate-600">時給の設定と顔認証の登録</p>
      </div>
      <EmployeeManager initialEmployees={(data as Employee[]) ?? []} />
    </div>
  );
}
