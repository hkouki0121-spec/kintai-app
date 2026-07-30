#!/usr/bin/env node
/**
 * 管理画面各ページ相当の Supabase クエリ時間を計測（開発用）
 * Usage: node scripts/measure-page-perf.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  const path = resolve(root, ".env.local");
  try {
    const raw = readFileSync(path, "utf8");
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function timed(label, fn) {
  const start = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - start);
  return { label, ms, result };
}

function jstMonthRange(year, month) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { from, to };
}

const EMPLOYEE_LIST =
  "id, name, employee_code, store_id, hourly_rate, company_id, is_active, created_at, job_title, hired_at";
const ATTENDANCE_SELECT =
  "id, employee_id, store_id, company_id, clock_in, clock_out, is_qr_clock, created_at, employees(id, name, employee_code, store_id, stores(id, name))";

async function main() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const { from, to } = jstMonthRange(year, month);

  console.log("=== Supabase クエリ計測（サービスロール）===\n");

  const pages = [];

  // Dashboard
  const dash = await Promise.all([
    timed("dashboard:stores", () =>
      supabase.from("stores").select("id, name, is_active, company_id").eq("is_active", true).order("name")
    ),
    timed("dashboard:employee_count", () =>
      supabase.from("employees").select("*", { count: "exact", head: true }).eq("is_active", true)
    ),
    timed("dashboard:open_attendance", () =>
      supabase.from("attendance_records").select("*", { count: "exact", head: true }).is("clock_out", null)
    ),
    timed("dashboard:recent", () =>
      supabase
        .from("attendance_records")
        .select("clock_in, employees(name, stores(name))")
        .order("clock_in", { ascending: false })
        .limit(5)
    ),
  ]);
  const dashMs = dash.reduce((s, d) => s + d.ms, 0);
  const dashSlow = [...dash].sort((a, b) => b.ms - a.ms)[0];
  pages.push({
    page: "ダッシュボード",
    totalMs: dashMs,
    apiCalls: 4,
    slowest: `${dashSlow.label} (${dashSlow.ms}ms)`,
    queries: dash,
  });

  // Employees
  const emp = await Promise.all([
    timed("employees:stores", () =>
      supabase.from("stores").select("id, name, is_active, company_id").order("name")
    ),
    timed("employees:list", () =>
      supabase.from("employees").select(`${EMPLOYEE_LIST}, stores(id, name)`).order("name")
    ),
  ]);
  const empMs = emp.reduce((s, d) => s + d.ms, 0);
  const empSlow = [...emp].sort((a, b) => b.ms - a.ms)[0];
  pages.push({
    page: "従業員一覧",
    totalMs: empMs,
    apiCalls: 2,
    slowest: `${empSlow.label} (${empSlow.ms}ms)`,
    queries: emp,
  });

  // Payroll
  const payroll = await timed("payroll:list", () =>
    supabase
      .from("payroll_records")
      .select(
        "id, year, month, employee_id, regular_hours, night_hours, regular_pay, night_pay, total_pay, attendance_days, employees(id, name, employee_code, hourly_rate, store_id, stores(id, name))"
      )
      .eq("year", year)
      .eq("month", month)
      .order("employees(name)")
  );
  pages.push({
    page: "給与一覧",
    totalMs: payroll.ms,
    apiCalls: 1,
    slowest: `${payroll.label} (${payroll.ms}ms)`,
    queries: [payroll],
  });

  // Attendance
  const att = await Promise.all([
    timed("attendance:stores", () =>
      supabase.from("stores").select("id, name, is_active, company_id").eq("is_active", true).order("name")
    ),
    timed("attendance:records", () =>
      supabase
        .from("attendance_records")
        .select(ATTENDANCE_SELECT)
        .gte("clock_in", `${from}T00:00:00+09:00`)
        .lte("clock_in", `${to}T23:59:59+09:00`)
        .order("clock_in", { ascending: false })
        .limit(500)
    ),
    timed("attendance:employees", () =>
      supabase
        .from("employees")
        .select("id, name, employee_code, store_id, hourly_rate, company_id, is_active, stores(id, name)")
        .eq("is_active", true)
        .order("name")
    ),
  ]);
  const attMs = att.reduce((s, d) => s + d.ms, 0);
  const attSlow = [...att].sort((a, b) => b.ms - a.ms)[0];
  pages.push({
    page: "勤怠履歴",
    totalMs: attMs,
    apiCalls: 3,
    slowest: `${attSlow.label} (${attSlow.ms}ms)`,
    queries: att,
  });

  // Stores
  const stores = await Promise.all([
    timed("stores:list", () => supabase.from("stores").select("*").order("name")),
    timed("stores:line_groups", () =>
      supabase.from("line_groups").select("*").order("last_seen_at", { ascending: false })
    ),
  ]);
  const storesMs = stores.reduce((s, d) => s + d.ms, 0);
  const storesSlow = [...stores].sort((a, b) => b.ms - a.ms)[0];
  pages.push({
    page: "店舗管理",
    totalMs: storesMs,
    apiCalls: 2,
    slowest: `${storesSlow.label} (${storesSlow.ms}ms)`,
    queries: stores,
  });

  // Auth context (simulated)
  const auth = await timed("auth:company_member", () =>
    supabase.from("company_members").select("role, company_id").limit(1).maybeSingle()
  );

  console.log("| ページ | Supabase合計(ms) | API数 | 最遅クエリ |");
  console.log("|--------|------------------|-------|------------|");
  for (const p of pages) {
    console.log(`| ${p.page} | ${p.totalMs} | ${p.apiCalls} | ${p.slowest} |`);
  }
  console.log(`\n認証相当クエリ: ${auth.label} ${auth.ms}ms`);
  console.log("\n--- 詳細 ---");
  for (const p of pages) {
    console.log(`\n[${p.page}]`);
    for (const q of p.queries) {
      const count = q.result?.data?.length ?? q.result?.count ?? "—";
      console.log(`  ${q.label}: ${q.ms}ms (rows: ${count})`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
