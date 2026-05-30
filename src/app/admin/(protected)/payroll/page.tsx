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
          15分未満の勤務は除外、30分単位切り捨て。22時以降は時給1.25倍。PDF出力・月末自動計算に対応。
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
