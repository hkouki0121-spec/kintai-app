"use client";

import { usePathname } from "next/navigation";
import { useRef, type ReactNode } from "react";

/** 計測対象の主要ルートはマウントを維持し、表示切替のみ行う */
const KEEP_ALIVE_ROUTES = new Set([
  "/admin/dashboard",
  "/admin/employees",
  "/admin/payroll",
  "/admin/attendance",
  "/admin/stores",
]);

export function AdminKeepAliveContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const cache = useRef(new Map<string, ReactNode>());

  if (KEEP_ALIVE_ROUTES.has(pathname) && !cache.current.has(pathname)) {
    cache.current.set(pathname, children);
  }

  if (!KEEP_ALIVE_ROUTES.has(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      {Array.from(cache.current.entries()).map(([path, node]) => (
        <div key={path} hidden={path !== pathname} aria-hidden={path !== pathname}>
          {node}
        </div>
      ))}
    </>
  );
}
