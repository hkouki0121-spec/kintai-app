#!/usr/bin/env node
/**
 * line_groups テーブルを Supabase に作成する。
 * 使い方:
 *   SUPABASE_DB_PASSWORD=your-db-password node scripts/apply-line-groups-migration.mjs
 *
 * DB パスワード: Supabase Dashboard > Project Settings > Database > Database password
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx);
    const value = trimmed.slice(idx + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();

  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(
    /https:\/\/([^.]+)\.supabase\.co/
  )?.[1];
  const password = process.env.SUPABASE_DB_PASSWORD;

  if (!projectRef) {
    console.error("NEXT_PUBLIC_SUPABASE_URL が見つかりません");
    process.exit(1);
  }
  if (!password) {
    console.error("SUPABASE_DB_PASSWORD が未設定です");
    process.exit(1);
  }

  const sqlPath = path.join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "SUPABASE_RUN_LINE_GROUPS.sql"
  );
  const sql = fs.readFileSync(sqlPath, "utf8");

  const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;

  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    await client.query(sql);
    const { rows } = await client.query(
      "SELECT count(*)::int AS count FROM public.line_groups"
    );
    console.log("Migration applied. line_groups count:", rows[0]?.count ?? 0);
  } catch (error) {
    const fallback = `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;
    if (String(error).includes("Tenant or user not found")) {
      const fallbackClient = new pg.Client({
        connectionString: fallback,
        ssl: { rejectUnauthorized: false },
      });
      await fallbackClient.connect();
      await fallbackClient.query(sql);
      const { rows } = await fallbackClient.query(
        "SELECT count(*)::int AS count FROM public.line_groups"
      );
      console.log("Migration applied (direct). line_groups count:", rows[0]?.count ?? 0);
      await fallbackClient.end();
      return;
    }
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
