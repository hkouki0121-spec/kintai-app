import { createClient } from "@/lib/supabase/server";
import { PayrollManager } from "@/components/admin/PayrollManager";
import type { PayrollWithEmployee } from "@/types/database";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  const supabase = await createClient();
  const { data } = await supabase
    .from("monthly_payroll")
    .select("*, employees(id, name, employee_code)")
    .eq("year", year)
    .eq("month", month)
    .order("total_pay", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">給与計算</h2>
        <p className="text-sm text-slate-600">
          22時以降は時給1.25倍。給与は勤務時間を30分単位で切り捨てて計算します（実勤務時間も表示）。
        </p>
      </div>
      <PayrollManager
        initialPayroll={(data as PayrollWithEmployee[]) ?? []}
        initialYear={year}
        initialMonth={month}
      />
    </div>
  );
}
