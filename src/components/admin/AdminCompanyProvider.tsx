"use client";

import { createContext, useContext, useMemo } from "react";
import type { CompanyContext } from "@/lib/auth/company-context";
import { AdminRenderProfiler } from "@/lib/perf/render-profiler";

const AdminCompanyContext = createContext<CompanyContext | null>(null);

export function AdminCompanyProvider({
  context,
  children,
}: {
  context: CompanyContext;
  children: React.ReactNode;
}) {
  const value = useMemo(() => context, [context]);
  return (
    <AdminRenderProfiler id="AuthProvider">
      <AdminCompanyContext.Provider value={value}>{children}</AdminCompanyContext.Provider>
    </AdminRenderProfiler>
  );
}

export function useAdminCompany(): CompanyContext {
  const context = useContext(AdminCompanyContext);
  if (!context) {
    throw new Error("useAdminCompany must be used within AdminCompanyProvider");
  }
  return context;
}
