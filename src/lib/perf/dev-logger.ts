/** 開発環境のみのパフォーマンス計測ログ */

const ENABLED = process.env.NODE_ENV === "development";

export function perfLog(event: string, data?: Record<string, unknown>): void {
  if (!ENABLED) return;
  if (data) {
    console.log(`[perf] ${event}`, data);
  } else {
    console.log(`[perf] ${event}`);
  }
}

export function perfTime(label: string): () => void {
  if (!ENABLED) return () => {};
  const start = performance.now();
  perfLog(`${label}-start`);
  return () => {
    const ms = Math.round(performance.now() - start);
    perfLog(`${label}-complete`, { ms });
  };
}
