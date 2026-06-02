#!/usr/bin/env node
/**
 * Supabase Management API 経由で migration SQL を実行する。
 * 使い方:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx npm run db:migrate:multi-company
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-migration-via-management-api.mjs 20250608_multi_company.sql
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = "ivbpwaagnoproqbsswh";

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

  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) {
    console.error("SUPABASE_ACCESS_TOKEN が未設定です");
    process.exit(1);
  }

  const migrationFile =
    process.argv[2]?.trim() || "20250604_line_groups.sql";
  const sqlPath = path.join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    migrationFile
  );
  if (!fs.existsSync(sqlPath)) {
    console.error(`Migration file not found: ${sqlPath}`);
    process.exit(1);
  }
  const query = fs.readFileSync(sqlPath, "utf8");
  console.log(`Applying ${migrationFile} ...`);

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    }
  );

  const body = await response.text();
  if (!response.ok) {
    console.error(`API error (${response.status}):`, body);
    process.exit(1);
  }

  console.log("Migration applied via Management API");
  console.log(body.slice(0, 500));
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
