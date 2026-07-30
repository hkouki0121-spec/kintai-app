#!/usr/bin/env node
/**
 * 管理画面ルートの RSC ペイロード取得時間を計測（認証Cookieなし・SSR応答時間のみ）
 * Usage: node scripts/measure-admin-routes.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? "http://localhost:3000";

const ROUTES = [
  "/admin/dashboard",
  "/admin/employees",
  "/admin/payroll",
  "/admin/attendance",
  "/admin/stores",
];

async function measureRoute(path) {
  const url = `${BASE}${path}`;
  const start = performance.now();
  try {
    const res = await fetch(url, {
      headers: { Accept: "text/html" },
      redirect: "manual",
    });
    const ms = Math.round(performance.now() - start);
    const size = Number(res.headers.get("content-length") ?? 0);
    return {
      path,
      status: res.status,
      ms,
      sizeKb: size ? Math.round(size / 1024) : null,
      redirected: res.status >= 300 && res.status < 400,
    };
  } catch (error) {
    return {
      path,
      status: "error",
      ms: Math.round(performance.now() - start),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log(`Measuring admin routes at ${BASE}\n`);
  console.log("| Route | Status | Time (ms) |");
  console.log("|-------|--------|-----------|");
  for (const path of ROUTES) {
    const result = await measureRoute(path);
    console.log(`| ${result.path} | ${result.status} | ${result.ms} |`);
    if (result.redirected) {
      console.log(`  → redirected (auth required)`);
    }
    if (result.error) {
      console.log(`  → ${result.error}`);
    }
  }
}

main();
