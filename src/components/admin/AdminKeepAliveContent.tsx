"use client";

import { memo, useState, type ComponentType, type ReactNode } from "react";
import { DashboardPageClient } from "@/components/admin/pages/DashboardPageClient";
import { EmployeesPageClient } from "@/components/admin/pages/EmployeesPageClient";
import { PayrollPageClient } from "@/components/admin/pages/PayrollPageClient";
import { AttendancePageClient } from "@/components/admin/pages/AttendancePageClient";
import { StoresPageClient } from "@/components/admin/pages/StoresPageClient";
import { KEEP_ALIVE_ROUTES, useAdminDisplayPath } from "@/components/admin/AdminNavigationProvider";
import { countRender } from "@/lib/perf/render-counts";

const PAGE_COMPONENTS: Record<string, ComponentType> = {
  "/admin/dashboard": DashboardPageClient,
  "/admin/employees": EmployeesPageClient,
  "/admin/payroll": PayrollPageClient,
  "/admin/attendance": AttendancePageClient,
  "/admin/stores": StoresPageClient,
};

const KEEP_ALIVE_PATHS = Object.keys(PAGE_COMPONENTS);

const KeepAlivePage = memo(function KeepAlivePage({
  path,
  visible,
}: {
  path: string;
  visible: boolean;
}) {
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) {
    setMounted(true);
  }
  countRender(`KeepAlive:${path}`);
  if (!mounted) return null;
  const Page = PAGE_COMPONENTS[path];
  return (
    <div
      hidden={!visible}
      aria-hidden={!visible}
      data-visible-page={visible ? path : undefined}
    >
      <Page />
    </div>
  );
});

/** 訪問したページだけマウントし、以降は hidden 切替。未訪問ページは載せない。 */
export const AdminKeepAliveContent = memo(function AdminKeepAliveContent({
  children,
}: {
  children: ReactNode;
}) {
  const displayPath = useAdminDisplayPath();

  return (
    <>
      {KEEP_ALIVE_PATHS.map((path) => (
        <KeepAlivePage key={path} path={path} visible={displayPath === path} />
      ))}
      {!KEEP_ALIVE_ROUTES.has(displayPath) ? children : null}
    </>
  );
});
