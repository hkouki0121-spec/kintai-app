#!/usr/bin/env node
/**
 * 管理画面のページ遷移を計測（Route / Network / JS chunks / Loading）
 *
 * Usage:
 *   PERF_TEST_EMAIL=... PERF_TEST_PASSWORD=... node scripts/measure-navigation-perf.mjs
 *   node scripts/measure-navigation-perf.mjs --browser=webkit
 *   node scripts/measure-navigation-perf.mjs --base=https://kintai-app-gamma.vercel.app
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

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

const args = process.argv.slice(2);
const browserArg = args.find((a) => a.startsWith("--browser="))?.split("=")[1] ?? "chromium";
const baseUrl = args.find((a) => a.startsWith("--base="))?.split("=")[1] ?? "http://localhost:3000";
const email = process.env.PERF_TEST_EMAIL ?? process.env.ADMIN_TEST_EMAIL;
const password = process.env.PERF_TEST_PASSWORD ?? process.env.ADMIN_TEST_PASSWORD;

const ROUTES = [
  { path: "/admin/dashboard", label: "ダッシュボード", navLabel: "ダッシュボード", heading: "ダッシュボード" },
  { path: "/admin/employees", label: "従業員一覧", navLabel: "従業員", heading: "従業員一覧" },
  { path: "/admin/payroll", label: "給与一覧", navLabel: "給与", heading: "給与一覧" },
  { path: "/admin/attendance", label: "勤怠履歴", navLabel: "勤怠履歴", heading: "勤怠履歴" },
  { path: "/admin/stores", label: "店舗管理", navLabel: "店舗管理", heading: "店舗管理" },
];

const NAV_SEQUENCE = [
  ["ダッシュボード", "従業員一覧"],
  ["従業員一覧", "給与一覧"],
  ["給与一覧", "勤怠履歴"],
  ["勤怠履歴", "店舗管理"],
  ["店舗管理", "ダッシュボード"],
  ["ダッシュボード", "ダッシュボード"], // cached revisit
];

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

async function createAuthCookies(base) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceKey) {
    throw new Error("Supabase 環境変数が不足しています");
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const anon = createClient(supabaseUrl, anonKey);
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1 });
  const adminEmail = users.users?.[0]?.email;
  if (!adminEmail) throw new Error("管理者ユーザーが見つかりません");

  const { data: link } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: adminEmail,
  });
  const otp = link?.properties?.email_otp;
  if (!otp) throw new Error("OTP 取得失敗");

  const { data, error } = await anon.auth.verifyOtp({ email: adminEmail, token: otp, type: "email" });
  if (error || !data.session) throw new Error(error?.message ?? "セッション取得失敗");

  const stored = [];
  const server = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => stored,
      setAll: (toSet) => {
        toSet.forEach((c) =>
          stored.push({
            name: c.name,
            value: c.value,
            ...c.options,
          })
        );
      },
    },
  });
  await server.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  const host = new URL(base).hostname;
  const secure = base.startsWith("https");
  return stored.map((c) => ({
    name: c.name,
    value: c.value,
    domain: host,
    path: c.path ?? "/",
    httpOnly: c.httpOnly ?? false,
    secure: c.secure ?? secure,
    sameSite: "Lax",
  }));
}

async function login(page, context) {
  if (email && password) {
    await page.goto(`${baseUrl}/admin/login`, { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: "ログイン" }).click();
    await page.waitForURL(/\/admin\/(dashboard|employees|payroll|attendance|stores)/, { timeout: 30000 });
    return;
  }

  const cookies = await createAuthCookies(baseUrl);
  await context.addCookies(cookies);
  await page.goto(`${baseUrl}/admin/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/admin\/(dashboard|employees|payroll|attendance|stores)/, { timeout: 30000 });
}

async function measureTransition(page, fromLabel, toLabel, pass) {
  const toRoute = ROUTES.find((r) => r.label === toLabel);
  if (!toRoute) return null;

  const requests = [];
  const onRequest = (req) => {
    requests.push({
      url: req.url(),
      method: req.method(),
      resourceType: req.resourceType(),
      at: performance.now(),
    });
  };
  page.on("request", onRequest);

  const fromPath = page.url();
  const navLink = page.getByRole("link", { name: toRoute.navLabel, exact: true });

  const t0 = performance.now();
  const chunkUrlsBefore = await page.evaluate(() =>
    performance.getEntriesByType("resource").filter((e) => e.name.includes(".js")).map((e) => e.name)
  );

  await navLink.click();

  let loadingMs = null;
  const loadingStart = performance.now();
  const skeleton = page.locator("[data-admin-loading-skeleton]");
  try {
    await skeleton.waitFor({ state: "visible", timeout: 500 });
    await skeleton.waitFor({ state: "hidden", timeout: 15000 });
    loadingMs = Math.round(performance.now() - loadingStart);
  } catch {
    loadingMs = 0;
  }

  await page.getByRole("heading", { name: toRoute.heading }).first().waitFor({ timeout: 30000 });
  const transitionMs = Math.round(performance.now() - t0);

  page.off("request", onRequest);

  const resources = await page.evaluate((before) => {
    return performance
      .getEntriesByType("resource")
      .filter((e) => e.name.includes(".js") && !before.includes(e.name))
      .map((e) => ({
        name: e.name.split("/").pop() ?? e.name,
        transferSize: e.transferSize,
        encodedSize: e.encodedBodySize,
        duration: Math.round(e.duration),
      }));
  }, chunkUrlsBefore);

  const jsAdded = resources.reduce((s, r) => s + (r.transferSize || r.encodedSize || 0), 0);

  const apiCalls = requests.filter(
    (r) =>
      r.resourceType === "fetch" ||
      r.url.includes("/api/") ||
      r.url.includes("_rsc=") ||
      r.url.includes("__nextjs")
  );

  const grouped = new Map();
  for (const r of apiCalls) {
    const key = `${r.method} ${new URL(r.url).pathname}`;
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }

  const duplicates = [...grouped.entries()].filter(([, c]) => c > 1);

  return {
    pass,
    from: fromLabel,
    to: toLabel,
    fromPath,
    toPath: page.url(),
    transitionMs,
    loadingMs,
    apiCallCount: apiCalls.length,
    apiGrouped: Object.fromEntries(grouped),
    duplicateApis: duplicates,
    jsChunksLoaded: resources.filter((r) => r.name.endsWith(".js")).length,
    jsTransferKb: formatKb(jsAdded),
  };
}

async function main() {
  const browserType = browserArg === "webkit" ? webkit : chromium;
  console.log(`\n=== Navigation Perf (${browserArg}) @ ${baseUrl} ===\n`);

  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      browserArg === "webkit"
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        : "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
  });
  const page = await context.newPage();
  const renderLogs = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("[perf]")) renderLogs.push(text);
  });

  await login(page, context);

  // 全ページ初回訪問
  for (const route of ROUTES) {
    await page.goto(`${baseUrl}${route.path}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.locator(`h2:has-text("${route.heading}")`).first().waitFor({ timeout: 30000 });
  }

  const results = [];
  for (let i = 0; i < NAV_SEQUENCE.length; i++) {
    const [from, to] = NAV_SEQUENCE[i];
    const pass = i < NAV_SEQUENCE.length - 1 ? (i < 5 ? "初回遷移" : "キャッシュ再訪問") : "キャッシュ再訪問";
    const row = await measureTransition(page, from, to, pass);
    if (row) results.push(row);
    await page.waitForTimeout(300);
  }

  console.log("| 遷移 | 種別 | Route Transition | Loading表示 | API数 | JS追加 |");
  console.log("|------|------|------------------|---------------|-------|--------|");
  for (const r of results) {
    console.log(
      `| ${r.from} → ${r.to} | ${r.pass} | ${r.transitionMs}ms | ${r.loadingMs}ms | ${r.apiCallCount} | ${r.jsTransferKb} |`
    );
  }

  console.log("\n--- API呼び出し詳細 ---");
  for (const r of results) {
    console.log(`\n[${r.from} → ${r.to}] (${r.pass})`);
    for (const [url, count] of Object.entries(r.apiGrouped)) {
      const mark = count > 1 ? " ⚠️重複" : "";
      console.log(`  ${count}x ${url}${mark}`);
    }
    if (r.duplicateApis.length) {
      console.log("  重複理由: React StrictMode / prefetch / RSC flight + layout 再検証の可能性");
    }
  }

  const cached = results.filter((r) => r.pass === "キャッシュ再訪問");
  const first = results.filter((r) => r.pass === "初回遷移");
  const avg = (arr, key) =>
    arr.length ? Math.round(arr.reduce((s, r) => s + r[key], 0) / arr.length) : 0;

  console.log("\n--- サマリー ---");
  console.log(`初回遷移 平均: ${avg(first, "transitionMs")}ms (n=${first.length})`);
  console.log(`キャッシュ再訪問 平均: ${avg(cached, "transitionMs")}ms (n=${cached.length})`);
  console.log(`Loading表示 平均(初回): ${avg(first, "loadingMs")}ms`);
  console.log(`Loading表示 平均(キャッシュ): ${avg(cached, "loadingMs")}ms`);

  const renderCounts = new Map();
  for (const line of renderLogs) {
    const m = line.match(/component: ['"]([^'"]+)['"]/);
    if (m) renderCounts.set(m[1], (renderCounts.get(m[1]) ?? 0) + 1);
  }
  if (renderCounts.size) {
    console.log("\n--- React Profiler 再レンダー回数 ---");
    for (const [id, count] of [...renderCounts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${id}: ${count}回`);
    }
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
