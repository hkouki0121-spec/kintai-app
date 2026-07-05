"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { measureNavigation, readPerfMetrics, type PerfMetric } from "@/lib/perf/client-metrics";

export function AdminPerfMetrics() {
  const pathname = usePathname();
  const [metrics, setMetrics] = useState<PerfMetric[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    measureNavigation(pathname);
    setMetrics(readPerfMetrics());
  }, [pathname]);

  if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_SHOW_PERF_METRICS) {
    return null;
  }

  return (
    <div className="fixed bottom-3 right-3 z-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-white shadow-lg"
      >
        計測 {metrics[0] ? `${metrics[0].ms}ms` : "—"}
      </button>
      {open && (
        <div className="mt-2 max-h-64 w-72 overflow-auto rounded-xl bg-white p-3 text-xs shadow-xl ring-1 ring-slate-200">
          <p className="mb-2 font-semibold text-slate-800">パフォーマンス（直近）</p>
          {metrics.length === 0 ? (
            <p className="text-slate-500">まだ計測データがありません</p>
          ) : (
            <ul className="space-y-1">
              {metrics.map((item) => (
                <li key={`${item.at}-${item.label}`} className="flex justify-between gap-2">
                  <span className="truncate text-slate-600">{item.label}</span>
                  <span className="shrink-0 font-mono font-medium text-emerald-700">{item.ms}ms</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
