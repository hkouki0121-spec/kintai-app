"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { StoreSelect } from "@/components/admin/StoreSelect";
import { Card } from "@/components/ui/Card";
import { ALL_STORES_VALUE } from "@/lib/stores/constants";
import type { Store } from "@/types/database";

type RecentRow = {
  clock_in: string;
  employees: { name: string; stores: { name: string } | null } | null;
};

type Props = {
  stores: Pick<Store, "id" | "name">[];
  employeeCount: number;
  openAttendance: number;
  recent: RecentRow[];
};

export function DashboardContent({
  stores,
  employeeCount,
  openAttendance,
  recent,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = searchParams.get("store") ?? ALL_STORES_VALUE;

  const handleStoreChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL_STORES_VALUE) params.delete("store");
    else params.set("store", value);
    router.push(`/admin?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">ダッシュボード</h2>
          <p className="text-sm text-slate-600">勤怠・給与の概要</p>
        </div>
        <StoreSelect stores={stores} value={storeId} onChange={handleStoreChange} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">在籍従業員</p>
          <p className="mt-1 text-3xl font-bold">{employeeCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">現在出勤中</p>
          <p className="mt-1 text-3xl font-bold text-blue-600">{openAttendance}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">クイックリンク</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li>
              <Link href="/admin/stores" className="text-blue-600 hover:underline">
                店舗を管理
              </Link>
            </li>
            <li>
              <Link href="/admin/employees" className="text-blue-600 hover:underline">
                従業員を管理
              </Link>
            </li>
            <li>
              <Link href="/admin/payroll" className="text-blue-600 hover:underline">
                給与を計算
              </Link>
            </li>
          </ul>
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold text-slate-900">直近の打刻</h3>
        <ul className="mt-3 divide-y divide-slate-100">
          {recent.map((row, i) => {
            const emp = row.employees;
            return (
              <li key={i} className="flex justify-between gap-2 py-2 text-sm">
                <span>
                  {emp?.name ?? "—"}
                  {emp?.stores?.name && (
                    <span className="ml-2 text-slate-400">({emp.stores.name})</span>
                  )}
                </span>
                <span className="shrink-0 text-slate-500">
                  {new Date(row.clock_in).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                </span>
              </li>
            );
          })}
          {recent.length === 0 && (
            <li className="py-4 text-center text-sm text-slate-500">記録がありません</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
