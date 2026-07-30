/** サーバー側の Supabase / データ取得計測（開発環境のみ） */

type FetchMeta = {
  page: string;
  resource: "stores" | "employees" | "payroll" | "attendance" | "auth";
  detail?: string;
};

export async function measurePageFetch<T>(
  meta: FetchMeta,
  fn: () => Promise<T>
): Promise<T> {
  if (process.env.NODE_ENV !== "development") {
    return fn();
  }
  const label = `${meta.page}:${meta.resource}`;
  const start = performance.now();
  console.log(`[perf/server] query-start`, { ...meta, label });
  try {
    return await fn();
  } finally {
    console.log(`[perf/server] query-complete`, {
      ...meta,
      label,
      ms: Math.round(performance.now() - start),
    });
  }
}
