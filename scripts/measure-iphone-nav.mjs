#!/usr/bin/env node
/**
 * iPhone Safari (WebKit) 相当で本番の管理画面遷移を計測する。
 * Skeleton 非表示待ちの 500ms タイムアウトを入れない。
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit, devices } from "playwright";
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
const browserArg = args.find((a) => a.startsWith("--browser="))?.split("=")[1] ?? "webkit";
const baseUrl =
  args.find((a) => a.startsWith("--base="))?.split("=")[1] ?? "https://kintai-app-gamma.vercel.app";

const TRANSITIONS = [
  { from: "ダッシュボード", to: "従業員", href: "/admin/employees", heading: "従業員一覧" },
  { from: "従業員", to: "給与", href: "/admin/payroll", heading: "給与一覧" },
  { from: "給与", to: "勤怠履歴", href: "/admin/attendance", heading: "勤怠履歴" },
  { from: "勤怠履歴", to: "店舗管理", href: "/admin/stores", heading: "店舗管理" },
  { from: "店舗管理", to: "ダッシュボード", href: "/admin/dashboard", heading: "ダッシュボード" },
];

function classifyUrl(url) {
  try {
    const u = new URL(url);
    return `${u.pathname}`;
  } catch {
    return url;
  }
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
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: adminEmail });
  const otp = link?.properties?.email_otp;
  if (!otp) throw new Error("OTP 取得失敗");
  const { data, error } = await anon.auth.verifyOtp({ email: adminEmail, token: otp, type: "email" });
  if (error || !data.session) throw new Error(error?.message ?? "セッション取得失敗");

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

async function measureClick(page, item, pass) {
  const requests = [];
  const onRequest = (req) => {
    const type = req.resourceType();
    if (type === "fetch" || type === "xhr" || req.url().includes("/api/") || urlHasRsc(req.url())) {
      requests.push({
        method: req.method(),
        path: classifyUrl(req.url()),
        type,
        start: Date.now(),
      });
    }
  };
  const timings = [];
  const onResponse = async (res) => {
    const req = requests.find((r) => res.url().includes(r.path) && !r.ms);
    if (!req) return;
    try {
      req.ms = Date.now() - req.start;
      timings.push(req);
    } catch {
      // ignore
    }
  };
  page.on("request", onRequest);
  page.on("response", onResponse);

  await page.evaluate(() => {
    window.__ADMIN_RENDERS = {};
  });

  const t0 = await page.evaluate(() => performance.now());
  await page.getByRole("link", { name: item.to, exact: true }).click();

  const heading = page.getByRole("heading", { name: item.heading }).first();
  await heading.waitFor({ state: "visible", timeout: 20000 });
  const transitionMs = await page.evaluate((start) => Math.round(performance.now() - start), t0);

  const skeletonVisible = await page.locator("[data-admin-loading-skeleton]").count();
  let loadingMs = 0;
  if (skeletonVisible > 0) {
    const loadStart = Date.now();
    await page.locator("[data-admin-loading-skeleton]").first().waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});
    loadingMs = Date.now() - loadStart;
  }

  page.off("request", onRequest);
  page.off("response", onResponse);

  const paintMs = await page.evaluate(() => window.__LAST_NAV_MS ?? null);
  const renders = await page.evaluate(() => window.__ADMIN_RENDERS ?? {});
  const apiPaths = requests.map((r) => `${r.method} ${r.path}`);
  const unique = [...new Set(apiPaths)];
  const slowest = [...requests].sort((a, b) => (b.ms ?? 0) - (a.ms ?? 0))[0];

  return {
    pass,
    from: item.from,
    to: item.to,
    href: item.href,
    transitionMs,
    paintMs,
    loadingMs,
    apiCount: requests.length,
    apis: unique,
    cacheHit: requests.length === 0,
    mode: requests.some((r) => r.path.includes("/admin/") && !r.path.startsWith("/api/"))
      ? "SSR/RSC"
      : "CSR",
    slowestApi: slowest ? `${slowest.method} ${slowest.path} ${slowest.ms ?? "?"}ms` : "—",
    renders,
  };
}

function urlHasRsc(url) {
  return url.includes("_rsc=") || url.includes("/_next/");
}

async function runPass(page, pass) {
  const rows = [];
  for (const item of TRANSITIONS) {
    rows.push(await measureClick(page, item, pass));
    await page.waitForTimeout(200);
  }
  return rows;
}

function printRows(rows) {
  console.log("| 遷移 | 種別 | 切替ms | 描画ms | Skeleton | API数 | キャッシュ | モード | 最遅API |");
  console.log("|------|------|--------|--------|----------|-------|------------|--------|---------|");
  for (const r of rows) {
    console.log(
      `| ${r.from} → ${r.to} | ${r.pass} | ${r.transitionMs}ms | ${r.paintMs ?? "—"} | ${r.loadingMs}ms | ${r.apiCount} | ${r.cacheHit ? "あり" : "なし"} | ${r.mode} | ${r.slowestApi} |`
    );
  }
  console.log("\n--- React 再レンダー ---");
  for (const r of rows) {
    const entries = Object.entries(r.renders).sort((a, b) => b[1] - a[1]);
    console.log(`[${r.from} → ${r.to}] ${entries.map(([k, v]) => `${k}:${v}`).join(", ") || "—"}`);
  }
  console.log("\n--- API ---");
  for (const r of rows) {
    console.log(`[${r.from} → ${r.to}] ${r.apis.join(", ") || "(なし)"}`);
  }
}

async function main() {
  const browserType = browserArg === "chromium" ? chromium : webkit;
  const device = devices["iPhone 14"];
  console.log(`\n=== iPhone nav (${browserArg}) @ ${baseUrl} ===\n`);

  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    ...device,
    locale: "ja-JP",
  });
  const page = await context.newPage();
  const cookies = await createAuthCookies(baseUrl);
  await context.addCookies(cookies);
  await page.goto(`${baseUrl}/admin/dashboard`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.getByRole("heading", { name: "ダッシュボード" }).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);

  const first = await runPass(page, "初回巡回");
  const cached = await runPass(page, "キャッシュ再訪問");

  console.log("### 初回巡回");
  printRows(first);
  console.log("\n### キャッシュ再訪問");
  printRows(cached);

  const avg = (arr) => Math.round(arr.reduce((s, r) => s + r.transitionMs, 0) / arr.length);
  console.log("\n--- サマリー ---");
  console.log(`初回平均: ${avg(first)}ms`);
  console.log(`キャッシュ平均: ${avg(cached)}ms`);
  console.log(`300ms超(初回): ${first.filter((r) => r.transitionMs >= 300).map((r) => r.to).join(", ") || "なし"}`);
  console.log(`300ms超(キャッシュ): ${cached.filter((r) => r.transitionMs >= 300).map((r) => r.to).join(", ") || "なし"}`);

  await browser.close();
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
