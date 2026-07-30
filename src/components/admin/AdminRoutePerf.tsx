"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { perfLog } from "@/lib/perf/dev-logger";
import { recordPerfMetric } from "@/lib/perf/client-metrics";

/** クライアント側のルート遷移計測（開発環境のみ） */
export function AdminRoutePerf() {
  const pathname = usePathname();
  const prevPath = useRef<string | null>(null);
  const navStart = useRef<number>(0);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href?.startsWith("/admin")) return;
      navStart.current = performance.now();
      perfLog("route-change-start", { from: pathname, to: href });
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const paintComplete = () => {
      const now = performance.now();
      const fromNav = navStart.current > 0 ? Math.round(now - navStart.current) : null;
      const label = `route ${pathname}`;
      if (fromNav !== null && fromNav > 0 && fromNav < 30000) {
        recordPerfMetric(`${label} (遷移)`, fromNav);
        perfLog("route-change-complete", { pathname, ms: fromNav });
        navStart.current = 0;
      }
      perfLog("render-complete", { pathname, ms: Math.round(now) });
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(paintComplete);
    });

    prevPath.current = pathname;
  }, [pathname]);

  return null;
}
