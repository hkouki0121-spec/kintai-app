"use client";

import { memo } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminNavProgress } from "@/components/admin/AdminNavProgress";
import { AdminRoutePerf } from "@/components/admin/AdminRoutePerf";
import { AdminPerfMetrics } from "@/components/admin/AdminPerfMetrics";
import { AdminRouteVisitTracker } from "@/components/admin/AdminRouteVisitTracker";
import { AdminDataPrefetch } from "@/components/admin/AdminDataPrefetch";
import { AdminKeepAliveContent } from "@/components/admin/AdminKeepAliveContent";
import { AdminRenderProfiler } from "@/lib/perf/render-profiler";

type Props = {
  children: React.ReactNode;
};

/** ヘッダー・ナビは固定。中央コンテンツのみ children で切り替わる。 */
export const AdminShell = memo(function AdminShell({ children }: Props) {
  return (
    <AdminRenderProfiler id="Layout">
      <div className="min-h-screen bg-slate-50">
        <AdminNavProgress />
        <AdminNav />
        <AdminRenderProfiler id="PageContent">
          <div className="mx-auto max-w-6xl p-4 sm:p-6">
            <AdminKeepAliveContent>{children}</AdminKeepAliveContent>
          </div>
        </AdminRenderProfiler>
        <AdminRouteVisitTracker />
        <AdminDataPrefetch />
        <AdminRoutePerf />
        <AdminPerfMetrics />
      </div>
    </AdminRenderProfiler>
  );
});
