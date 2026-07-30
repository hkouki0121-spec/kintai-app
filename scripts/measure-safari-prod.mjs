#!/usr/bin/env node
/**
 * 本番 Safari 相当のページ遷移計測（5遷移 + キャッシュ再訪問）
 * Usage: node scripts/measure-safari-prod.mjs [--browser=webkit|chromium]
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const baseUrl = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1]
  ?? "https://kintai-app-gamma.vercel.app";
const browserArg = process.argv.find((a) => a.startsWith("--browser="))?.split("=")[1] ?? "webkit";
const coldStart = process.argv.includes("--cold");

function loadEnv() {
  try {
    const raw = readFileSync(resolve(root, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // ignore
  }
}
loadEnv();

const TRANSITIONS = [
  { id: 1, from: "ダッシュボード", to: "従業員", navTo: "従業員", heading: "従業員一覧", path: "/admin/employees" },
  { id: 2, from: "従業員", to: "給与", navTo: "給与", heading: "給与一覧", path: "/admin/payroll" },
  { id: 3, from: "給与", to: "勤怠", navTo: "勤怠履歴", heading: "勤怠履歴", path: "/admin/attendance" },
  { id: 4, from: "勤怠", to: "店舗", navTo: "店舗管理", heading: "店舗管理", path: "/admin/stores" },
  { id: 5, from: "店舗", to: "ダッシュボード", navTo: "ダッシュボード", heading: "ダッシュボード", path: "/admin/dashboard" },
];

const CACHED_REVISIT = [
  { id: "C1", from: "ダッシュボード", to: "従業員(再訪)", navTo: "従業員", heading: "従業員一覧", path: "/admin/employees" },
  { id: "C2", from: "従業員(再訪)", to: "給与(再訪)", navTo: "給与", heading: "給与一覧", path: "/admin/payroll" },
];

async function createAuthCookies() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const anon = createClient(supabaseUrl, anonKey);
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1 });
  const email = users.users?.[0]?.email;
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const { data, error } = await anon.auth.verifyOtp({
    email,
    token: link.properties.email_otp,
    type: "email",
  });
  if (error || !data.session) throw new Error(error?.message ?? "auth failed");

  const stored = [];
  const server = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => stored,
      setAll: (toSet) => {
        toSet.forEach((c) => stored.push({ name: c.name, value: c.value, ...c.options }));
      },
    },
  });
  await server.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  const host = new URL(baseUrl).hostname;
  return stored.map((c) => ({
    name: c.name,
    value: c.value,
    domain: host,
    path: c.path ?? "/",
    httpOnly: c.httpOnly ?? false,
    secure: true,
    sameSite: "Lax",
  }));
}

async function measureOne(page, { from, to, navTo, heading, path }, passLabel) {
  const perfLogs = [];
  const apiTimings = [];
  const requests = [];

  const onConsole = (msg) => {
    const t = msg.text();
    if (t.includes("[perf]")) perfLogs.push(t);
  };
  const onRequest = (req) => {
    const url = req.url();
    if (
      url.includes("/api/") ||
      url.includes("/rest/v1/") ||
      url.includes("_rsc=") ||
      url.includes("/auth/")
    ) {
      requests.push({ method: req.method(), url, start: performance.now() });
    }
  };
  const onResponse = (res) => {
    const req = requests.find((r) => r.url === res.url() && !r.end);
    if (req) req.end = performance.now();
  };

  page.on("console", onConsole);
  page.on("request", onRequest);
  page.on("response", onResponse);

  const t0 = performance.now();
  await page.getByRole("link", { name: navTo, exact: true }).click({ noWaitAfter: true });

  let skeletonMs = 0;
  const skelStart = performance.now();
  const skeleton = page.locator("[data-admin-loading-skeleton]");
  try {
    await skeleton.waitFor({ state: "visible", timeout: 300 });
    await skeleton.waitFor({ state: "hidden", timeout: 10000 });
    skeletonMs = Math.round(performance.now() - skelStart);
  } catch {
    skeletonMs = 0;
  }

  await page.locator(`[data-visible-page="${path}"]`).waitFor({ state: "visible", timeout: 30000 });
  const transitionMs = Math.round(performance.now() - t0);

  page.off("console", onConsole);
  page.off("request", onRequest);
  page.off("response", onResponse);

  const apiGrouped = {};
  for (const r of requests) {
    let path;
    try {
      path = new URL(r.url).pathname;
    } catch {
      path = r.url;
    }
    const key = `${r.method} ${path}`;
    apiGrouped[key] = (apiGrouped[key] ?? 0) + 1;
    if (r.end) {
      apiTimings.push({ api: key, ms: Math.round(r.end - r.start) });
    }
  }

  const renderCounts = {};
  for (const line of perfLogs) {
    const m = line.match(/component: ['"]([^'"]+)['"]/);
    if (m) renderCounts[m[1]] = (renderCounts[m[1]] ?? 0) + 1;
    if (line.includes("query-start")) {
      const km = line.match(/key: ['"]?([^'",}]+)/);
      if (km) renderCounts[`query:${km[1]}`] = (renderCounts[`query:${km[1]}`] ?? 0) + 1;
    }
  }

  const cacheHit = !Object.keys(apiGrouped).some((k) => k.includes("/rest/v1/") || k.includes("/api/admin/"));

  return {
    from,
    to,
    passLabel,
    transitionMs,
    skeletonMs,
    apiCount: requests.length,
    apiGrouped,
    apiTimings: apiTimings.sort((a, b) => b.ms - a.ms),
    cacheHit,
    renderCounts,
    renderingMode: Object.keys(apiGrouped).some((k) => k.includes("_rsc=")) ? "RSC" : "CSR",
  };
}

async function main() {
  const browserType = browserArg === "webkit" ? webkit : chromium;
  console.log(`\n=== Safari Prod Measurement (${browserArg}) @ ${baseUrl} ===\n`);

  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  });

  const cookies = await createAuthCookies();
  await context.addCookies(cookies);
  const page = await context.newPage();

  await page.goto(`${baseUrl}/admin/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForResponse(
    (res) => res.url().includes("/api/auth/company-context") && res.status() === 200,
    { timeout: 30000 }
  ).catch(() => null);
  await page.locator('h2:has-text("ダッシュボード")').first().waitFor({ timeout: 30000 });

  // プリフェッチ完了を待つ（--cold 時はスキップして初回遷移を計測）
  if (!coldStart) {
    await page.waitForTimeout(2500);
  }

  const results = [];

  for (const t of TRANSITIONS) {
    results.push(await measureOne(page, t, "初回"));
    await page.waitForTimeout(200);
  }

  for (const t of CACHED_REVISIT) {
    results.push(await measureOne(page, t, "キャッシュ再訪問"));
    await page.waitForTimeout(200);
  }

  console.log("| # | 遷移 | 種別 | 切替ms | Skeleton | API数 | キャッシュ | 方式 |");
  console.log("|---|------|------|--------|----------|-------|------------|------|");
  for (const r of results) {
    console.log(
      `| ${r.passLabel === "初回" ? TRANSITIONS.find((t) => t.to === r.to || t.from === r.from)?.id ?? "C" : "C"} | ${r.from}→${r.to} | ${r.passLabel} | ${r.transitionMs}ms | ${r.skeletonMs}ms | ${r.apiCount} | ${r.cacheHit ? "✅" : "❌"} | ${r.renderingMode} |`
    );
  }

  console.log("\n--- 詳細 ---");
  for (const r of results) {
    console.log(`\n### ${r.from} → ${r.to} (${r.passLabel})`);
    console.log(`- 切替: ${r.transitionMs}ms, Skeleton: ${r.skeletonMs}ms, キャッシュ: ${r.cacheHit ? "利用" : "未利用"}`);
    if (Object.keys(r.apiGrouped).length) {
      console.log("- API:");
      for (const [k, v] of Object.entries(r.apiGrouped)) console.log(`  ${v}x ${k}`);
    } else {
      console.log("- API: なし（キャッシュのみ）");
    }
    if (r.apiTimings.length) {
      console.log(`- 最遅API: ${r.apiTimings[0].api} (${r.apiTimings[0].ms}ms)`);
    }
    if (Object.keys(r.renderCounts).length) {
      console.log("- Render/Query:", r.renderCounts);
    }
  }

  const slow = results.filter((r) => r.transitionMs >= 300);
  if (slow.length) {
    console.log("\n--- ⚠️ 300ms超 ---");
    for (const r of slow) {
      console.log(`${r.from}→${r.to}: ${r.transitionMs}ms (${r.renderingMode}, API=${r.apiCount})`);
    }
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
