"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** ページ遷移中の視覚的フィードバック（開発・本番共通） */
export function AdminNavProgress() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href?.startsWith("/admin") || href === pathname) return;
      setPending(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  useEffect(() => {
    setPending(false);
  }, [pathname]);

  if (!pending) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-blue-100"
      aria-hidden
    >
      <div className="h-full w-1/3 animate-pulse bg-blue-600" />
    </div>
  );
}
