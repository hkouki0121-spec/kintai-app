import type { DefaultOptions } from "@tanstack/react-query";

/** 管理画面共通の TanStack Query 設定 */
export const adminQueryDefaults: DefaultOptions = {
  queries: {
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  },
};

/** 認証コンテキストはログアウトまで保持 */
export const authQueryOptions = {
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  retry: false,
} as const;
