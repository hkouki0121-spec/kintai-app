export type PerfMetric = {
  label: string;
  ms: number;
  at: number;
};

const STORAGE_KEY = "admin:perf-metrics";
const MAX_ENTRIES = 20;

export function recordPerfMetric(label: string, ms: number): void {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const list: PerfMetric[] = raw ? (JSON.parse(raw) as PerfMetric[]) : [];
    list.unshift({ label, ms, at: Date.now() });
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
  } catch {
    // ignore quota / private mode
  }
}

export function readPerfMetrics(): PerfMetric[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PerfMetric[]) : [];
  } catch {
    return [];
  }
}

export function measureNavigation(pathname: string): void {
  if (typeof window === "undefined" || !("performance" in window)) return;
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (nav) {
    recordPerfMetric(`遷移 ${pathname}`, Math.round(nav.domContentLoadedEventEnd - nav.startTime));
  }
}
