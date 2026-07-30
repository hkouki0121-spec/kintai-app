#!/usr/bin/env node
/**
 * Supabase Management API で SQL を実行し結果を表示
 * 使い方: node scripts/run-sql-via-management-api.mjs "SELECT 1"
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

async function runSql(query) {
  loadEnvLocal();
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("SUPABASE_ACCESS_TOKEN が未設定です");
  }

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
    throw new Error(`API error (${response.status}): ${body}`);
  }

  return JSON.parse(body);
}

const query = process.argv[2];
if (!query) {
  console.error("Usage: node scripts/run-sql-via-management-api.mjs \"SELECT ...\"");
  process.exit(1);
}

runSql(query)
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error.message ?? error);
    process.exit(1);
  });
