"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

const KEEP_ALIVE_ROUTES = new Set([
  "/admin/dashboard",
  "/admin/employees",
  "/admin/payroll",
  "/admin/attendance",
  "/admin/stores",
]);

type AdminNavigationContextValue = {
  displayPath: string;
  navigateTo: (href: string) => void;
  isKeepAliveRoute: (href: string) => boolean;
};

const AdminNavigationContext = createContext<AdminNavigationContextValue | null>(null);

export function AdminNavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [displayPath, setDisplayPath] = useState(pathname);

  useEffect(() => {
    setDisplayPath(pathname);
  }, [pathname]);

  const navigateTo = useCallback(
    (href: string) => {
      if (KEEP_ALIVE_ROUTES.has(href)) {
        setDisplayPath(href);
      }
      startTransition(() => {
        router.push(href);
      });
    },
    [router]
  );

  const value = useMemo(
    () => ({
      displayPath,
      navigateTo,
      isKeepAliveRoute: (href: string) => KEEP_ALIVE_ROUTES.has(href),
    }),
    [displayPath, navigateTo]
  );

  return <AdminNavigationContext.Provider value={value}>{children}</AdminNavigationContext.Provider>;
}

export function useAdminNavigation() {
  const ctx = useContext(AdminNavigationContext);
  if (!ctx) {
    throw new Error("useAdminNavigation must be used within AdminNavigationProvider");
  }
  return ctx;
}

export { KEEP_ALIVE_ROUTES };
