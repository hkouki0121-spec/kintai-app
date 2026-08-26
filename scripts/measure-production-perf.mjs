#!/usr/bin/env node
/**
 * iPhone Safari 相当の本番計測（初回巡回 + キャッシュ再訪問）
 * Usage: node scripts/measure-production-perf.mjs [--browser=webkit|chromium]
 */
import { readFileSync, writeFileSync } from "node:fs";
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

const browserArg = process.argv.find((a) => a.startsWith("--browser="))?.split("=")[1] ?? "webkit";
const baseUrl =
  process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ??
  "https://kintai-app-gamma.vercel.app";

const NAV_HREF = {
  ダッシュボード: "/admin/dashboard",
  従業員: "/admin/employees",
  給与: "/admin/payroll",
  勤怠: "/admin/attendance",
  店舗: "/admin/stores",
};

function navHref(label) {
  return NAV_HREF[label] ?? `/admin/${label}`;
}

const TRANSITIONS = [
  { from: "ダッシュボード", to: "従業員", heading: "従業員一覧", nav: "従業員" },
  { from: "従業員", to: "給与", heading: "給与一覧", nav: "給与" },
  { from: "給与", to: "勤怠", heading: "勤怠履歴", nav: "勤怠履歴" },
  { from: "勤怠", to: "店舗", heading: "店舗管理", nav: "店舗管理" },
  { from: "店舗", to: "ダッシュボード", heading: "ダッシュボード", nav: "ダッシュボード" },
];

async function createAuthCookies(base) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const anon = createClient(supabaseUrl, anonKey);
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1 });
  const adminEmail = users.users?.[0]?.email;
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: adminEmail });
  const { data, error } = await anon.auth.verifyOtp({
    email: adminEmail,
    token: link.properties.email_otp,
    type: "email",
  });
  if (error || !data.session) throw new Error(error?.message ?? "session failed");

  const stored = [];
  const server = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => stored,
      setAll: (toSet) => toSet.forEach((c) => stored.push({ name: c.name, value: c.value, ...c.options })),
    },
  });
  await server.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  const host = new URL(base).hostname;
  return stored.map((c) => ({
    name: c.name,
    value: c.value,
    domain: host,
    path: "/",
    httpOnly: false,
    secure: base.startsWith("https"),
    sameSite: "Lax",
  }));
}

async function login(context, page) {
  const cookies = await createAuthCookies(baseUrl);
  await context.addCookies(cookies);
  await page.goto(`${baseUrl}/admin/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('h2:has-text("ダッシュボード")', { timeout: 45000 });
  await page.waitForTimeout(500);
}

function classifyApi(url) {
  if (url.includes("/rest/v1/")) return "Supabase";
  if (url.includes("/api/admin/")) return "Next API";
  if (url.includes("/api/auth/")) return "Auth API";
  if (url.includes("_rsc=")) return "RSC";
  return "Other";
}

async function measureOne(page, { from, to, heading, nav: navLabel }, pass) {
  const perfLogs = [];
  const onConsole = (msg) => {
    const t = msg.text();
    if (t.includes("[perf]")) perfLogs.push(t);
  };
  page.on("console", onConsole);

  const requests = [];
  const responses = [];
  const onReq = (req) => {
    const url = req.url();
    if (
      url.includes("/rest/v1/") ||
      url.includes("/api/") ||
      url.includes("_rsc=")
    ) {
      requests.push({ url, method: req.method(), start: performance.now(), type: classifyApi(url) });
    }
  };
  const onRes = (res) => {
    const url = res.url();
    const match = requests.find((r) => r.url === url && r.end == null);
    if (match) match.end = performance.now();
    if (url.includes("/rest/v1/") || url.includes("/api/")) {
      responses.push({ url, status: res.status(), ms: match ? Math.round(match.end - match.start) : null });
    }
  };
  page.on("request", onReq);
  page.on("response", onRes);

  const t0 = performance.now();
  const href = navHref(to);
  let loadingMs = 0;
  const skeleton = page.locator("[data-admin-loading-skeleton]");

  const navEl = page.locator(`a[href="${href}"]`).first();
  await navEl.dispatchEvent("mousedown");
  await page.waitForSelector(`[data-visible-page="${href}"]`, { timeout: 3000 }).catch(async () => {
    await page.getByRole("link", { name: navLabel, exact: true }).click();
  });
  const keepAliveMs = Math.round(performance.now() - t0);

  const skStart = performance.now();
  try {
    if (await skeleton.isVisible().catch(() => false)) {
      await skeleton.waitFor({ state: "hidden", timeout: 10000 });
      loadingMs = Math.round(performance.now() - skStart);
    }
  } catch {
    loadingMs = 0;
  }

  await page.locator(`h2:has-text("${heading}")`).first().waitFor({ timeout: 30000 });
  const transitionMs = Math.round(performance.now() - t0);

  page.off("console", onConsole);
  page.off("request", onReq);
  page.off("response", onRes);

  const grouped = {};
  for (const r of requests) {
    const path = new URL(r.url).pathname;
    const key = `${r.method} ${path}`;
    grouped[key] = (grouped[key] ?? 0) + 1;
  }

  const slowest = [...responses]
    .filter((r) => r.ms != null)
    .sort((a, b) => b.ms - a.ms)[0];

  const renderCounts = {};
  for (const line of perfLogs) {
    const m = line.match(/component: ['"]([^'"]+)['"]/);
    if (m) renderCounts[m[1]] = (renderCounts[m[1]] ?? 0) + 1;
  }

  const cacheHit = requests.length === 0;
  const mode = requests.some((r) => r.type === "RSC") ? "SSR/RSC" : "CSR";

  return {
    pass,
    transition: `${from} → ${to}`,
    keepAliveMs,
    transitionMs,
    loadingMs,
    apiCount: requests.length,
    apis: grouped,
    cacheHit,
    mode,
    slowestApi: slowest ? `${slowest.url.split("/").slice(-2).join("/")} (${slowest.ms}ms)` : "—",
    renderCounts,
    perfLogs: perfLogs.length,
  };
}

async function main() {
  const browserType = browserArg === "chromium" ? chromium : webkit;
  console.log(`\n=== Production Perf (${browserArg}, iPhone viewport) ===`);
  console.log(`URL: ${baseUrl}\n`);

  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();

  await login(context, page);

  const round1 = [];
  for (const t of TRANSITIONS) {
    round1.push(await measureOne(page, t, "初回巡回"));
    await page.waitForTimeout(200);
  }

  // 逆方向でキャッシュ再訪問
  const round2 = [];
  for (const t of [...TRANSITIONS].reverse()) {
    const rev = {
      from: t.to,
      to: t.from,
      heading: t.from === "ダッシュボード" ? "ダッシュボード" : TRANSITIONS.find((x) => x.to === t.from)?.heading ?? t.from,
      nav: t.from === "ダッシュボード" ? "ダッシュボード" : TRANSITIONS.find((x) => x.to === t.from)?.nav ?? t.from,
    };
    round2.push(await measureOne(page, rev, "キャッシュ再訪問"));
    await page.waitForTimeout(200);
  }

  const all = [...round1, ...round2];

  console.log("| # | 遷移 | 種別 | 切替ms | KeepAlive | Loading | API | キャッシュ |");
  console.log("|---|------|------|--------|-----------|---------|-----|------------|");
  all.forEach((r, i) => {
    console.log(
      `| ${i + 1} | ${r.transition} | ${r.pass} | ${r.transitionMs} | ${r.keepAliveMs ?? "—"}ms | ${r.loadingMs}ms | ${r.apiCount} | ${r.cacheHit ? "HIT" : "MISS"} |`
    );
  });

  console.log("\n--- 詳細 ---");
  for (const r of all) {
    console.log(`\n### ${r.transition} (${r.pass}) — ${r.transitionMs}ms`);
    console.log(`  キャッシュ: ${r.cacheHit ? "利用" : "未利用"} / 方式: ${r.mode}`);
    console.log(`  Skeleton: ${r.loadingMs}ms / 最遅API: ${r.slowestApi}`);
    if (Object.keys(r.apis).length) {
      console.log("  API:");
      for (const [k, v] of Object.entries(r.apis)) console.log(`    ${v}x ${k}`);
    }
    if (Object.keys(r.renderCounts).length) {
      console.log("  React render:");
      for (const [k, v] of Object.entries(r.renderCounts).sort((a, b) => b[1] - a[1])) {
        console.log(`    ${k}: ${v}回`);
      }
    }
  }

  const slow = all.filter((r) => r.transitionMs > 300);
  if (slow.length) {
    console.log("\n--- 300ms超 ---");
    for (const r of slow) {
      console.log(`  ${r.transition} (${r.pass}): ${r.transitionMs}ms — APIs: ${r.apiCount}, mode: ${r.mode}`);
    }
  }

  const report = {
    browser: browserArg,
    baseUrl,
    measuredAt: new Date().toISOString(),
    results: all,
    summary: {
      round1Avg: Math.round(round1.reduce((s, r) => s + r.transitionMs, 0) / round1.length),
      round2Avg: Math.round(round2.reduce((s, r) => s + r.transitionMs, 0) / round2.length),
    },
  };
  writeFileSync(resolve(root, "scripts/.perf-report.json"), JSON.stringify(report, null, 2));
  console.log("\nReport: scripts/.perf-report.json");

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
