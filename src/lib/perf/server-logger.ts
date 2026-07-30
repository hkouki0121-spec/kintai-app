/** サーバー側の開発環境計測ログ */

export function serverPerfLog(
  event: string,
  data?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV !== "development") return;
  if (data) {
    console.log(`[perf/server] ${event}`, data);
  } else {
    console.log(`[perf/server] ${event}`);
  }
}

export async function measureServer<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  if (process.env.NODE_ENV !== "development") {
    return fn();
  }
  const start = performance.now();
  serverPerfLog(`${label}-start`);
  try {
    return await fn();
  } finally {
    serverPerfLog(`${label}-complete`, { ms: Math.round(performance.now() - start) });
  }
}
