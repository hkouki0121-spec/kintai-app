"use client";

import { createContext, useContext } from "react";
import type { CompanyContext } from "@/lib/auth/company-context";

const AdminCompanyContext = createContext<CompanyContext | null>(null);

export function AdminCompanyProvider({
  context,
  children,
}: {
  context: CompanyContext;
  children: React.ReactNode;
}) {
  return (
    <AdminCompanyContext.Provider value={context}>{children}</AdminCompanyContext.Provider>
  );
}

export function useAdminCompany(): CompanyContext {
  const context = useContext(AdminCompanyContext);
  if (!context) {
    throw new Error("useAdminCompany must be used within AdminCompanyProvider");
  }
  return context;
}
