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
import { recordNavPaint } from "@/lib/perf/render-counts";

const KEEP_ALIVE_ROUTES = new Set([
  "/admin/dashboard",
  "/admin/employees",
  "/admin/payroll",
  "/admin/attendance",
  "/admin/stores",
]);

type AdminNavigationActions = {
  navigateTo: (href: string) => void;
  isKeepAliveRoute: (href: string) => boolean;
};

const ActionsContext = createContext<AdminNavigationActions | null>(null);
const PathContext = createContext<string>("/admin/dashboard");

export function AdminNavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [displayPath, setDisplayPath] = useState(pathname);

  useEffect(() => {
    setDisplayPath(pathname);
  }, [pathname]);

  const navigateTo = useCallback(
    (href: string) => {
      const start = performance.now();
      if (KEEP_ALIVE_ROUTES.has(href)) {
        setDisplayPath(href);
        window.history.pushState(null, "", href);
        recordNavPaint(href, start);
        return;
      }
      startTransition(() => {
        router.push(href);
      });
      recordNavPaint(href, start);
    },
    [router]
  );

  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      if (KEEP_ALIVE_ROUTES.has(path)) {
        setDisplayPath(path);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const actions = useMemo<AdminNavigationActions>(
    () => ({
      navigateTo,
      isKeepAliveRoute: (href: string) => KEEP_ALIVE_ROUTES.has(href),
    }),
    [navigateTo]
  );

  return (
    <ActionsContext.Provider value={actions}>
      <PathContext.Provider value={displayPath}>{children}</PathContext.Provider>
    </ActionsContext.Provider>
  );
}

export function useAdminNavigation() {
  const displayPath = useContext(PathContext);
  const actions = useContext(ActionsContext);
  if (!actions) {
    throw new Error("useAdminNavigation must be used within AdminNavigationProvider");
  }
  return { displayPath, ...actions };
}

export function useAdminNavigationActions() {
  const actions = useContext(ActionsContext);
  if (!actions) {
    throw new Error("useAdminNavigationActions must be used within AdminNavigationProvider");
  }
  return actions;
}

export function useAdminDisplayPath() {
  return useContext(PathContext);
}

export { KEEP_ALIVE_ROUTES };
