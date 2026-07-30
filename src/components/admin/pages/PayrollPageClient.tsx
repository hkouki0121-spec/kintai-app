"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PayrollManager } from "@/components/admin/PayrollManager";
import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";
import { parsePayrollStoreId } from "@/lib/queries/fetch-payroll";
import { useActiveStoresQuery, usePayrollQuery } from "@/lib/queries/hooks";

function PayrollPageInner() {
  const searchParams = useSearchParams();
  const now = new Date();
  const year = Number(searchParams.get("year")) || now.getFullYear();
  const month = Number(searchParams.get("month")) || now.getMonth() + 1;
  const storeId = parsePayrollStoreId(searchParams.get("store"));

  const { activeStores, isLoading: storesLoading, data: storesData } = useActiveStoresQuery();
  const { data: payroll, isLoading: payrollLoading } = usePayrollQuery(year, month, storeId);

  const isFirstLoad =
    (storesLoading && !storesData) || (payrollLoading && payroll === undefined);
  if (isFirstLoad) {
    return <AdminPageSkeleton pathname="/admin/payroll" variant="payroll" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">給与一覧</h2>
        <p className="mt-1 text-sm text-slate-500">月次給与の確認・再計算・CSV出力</p>
      </div>
      <PayrollManager
        stores={activeStores}
        storeId={storeId}
        year={year}
        month={month}
        payroll={payroll ?? []}
      />
    </div>
  );
}

export function PayrollPageClient() {
  return (
    <Suspense fallback={<AdminPageSkeleton pathname="/admin/payroll" variant="payroll" />}>
      <PayrollPageInner />
    </Suspense>
  );
}
