"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { perfLog } from "@/lib/perf/dev-logger";

const VISITED_KEY = "admin:visited-routes";

export function markRouteVisited(pathname: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(VISITED_KEY);
    const set = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    set.add(pathname);
    sessionStorage.setItem(VISITED_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

export function wasRouteVisited(pathname: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = sessionStorage.getItem(VISITED_KEY);
    const set = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    return set.has(pathname);
  } catch {
    return false;
  }
}

/** ルート表示完了時に訪問済みマーク + loading 表示時間の計測 */
export function AdminRouteVisitTracker() {
  const pathname = usePathname();
  const loadingStart = useRef<number | null>(null);

  useEffect(() => {
    const skeleton = document.querySelector("[data-admin-loading-skeleton]");
    if (skeleton) {
      loadingStart.current = performance.now();
      perfLog("loading-start", { pathname });
    }

    const paintComplete = () => {
      markRouteVisited(pathname);
      if (loadingStart.current !== null) {
        const ms = Math.round(performance.now() - loadingStart.current);
        perfLog("loading-complete", { pathname, ms });
        loadingStart.current = null;
      }
    };

    requestAnimationFrame(() => requestAnimationFrame(paintComplete));
  }, [pathname]);

  return null;
}
