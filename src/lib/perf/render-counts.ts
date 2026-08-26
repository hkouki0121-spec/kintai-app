/** 本番でも使える軽量な再レンダー回数カウンタ（console は出さない） */

declare global {
  interface Window {
    __ADMIN_RENDERS?: Record<string, number>;
    __LAST_NAV_MS?: number;
    __NAV_MARKS?: { href: string; start: number; paintMs: number }[];
  }
}

export function countRender(id: string): void {
  if (typeof window === "undefined") return;
  window.__ADMIN_RENDERS ??= {};
  window.__ADMIN_RENDERS[id] = (window.__ADMIN_RENDERS[id] ?? 0) + 1;
}

export function readRenderCounts(): Record<string, number> {
  if (typeof window === "undefined") return {};
  return { ...(window.__ADMIN_RENDERS ?? {}) };
}

export function resetRenderCounts(): void {
  if (typeof window === "undefined") return;
  window.__ADMIN_RENDERS = {};
}

export function recordNavPaint(href: string, start: number): void {
  if (typeof window === "undefined") return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const paintMs = Math.round(performance.now() - start);
      window.__LAST_NAV_MS = paintMs;
      window.__NAV_MARKS ??= [];
      window.__NAV_MARKS.push({ href, start, paintMs });
    });
  });
}
