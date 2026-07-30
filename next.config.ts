import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next.js 15 は dynamic の staleTime 既定が 0 のため、毎遷移で RSC を再取得する。
  // 管理画面は同一データの即時表示を優先し、30 秒はクライアントキャッシュを利用する。
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
};

export default withBundleAnalyzer(nextConfig);
