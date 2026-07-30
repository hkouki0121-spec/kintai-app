"use client";

import { usePathname } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { KEEP_ALIVE_ROUTES, useAdminNavigation } from "@/components/admin/AdminNavigationProvider";

export function AdminKeepAliveContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { displayPath } = useAdminNavigation();
  const cache = useRef(new Map<string, ReactNode>());

  if (KEEP_ALIVE_ROUTES.has(pathname) && !cache.current.has(pathname)) {
    cache.current.set(pathname, children);
  }

  if (!KEEP_ALIVE_ROUTES.has(displayPath)) {
    return <>{children}</>;
  }

  return (
    <>
      {Array.from(cache.current.entries()).map(([path, node]) => (
        <div key={path} hidden={path !== displayPath} aria-hidden={path !== displayPath}>
          {node}
        </div>
      ))}
    </>
  );
}
