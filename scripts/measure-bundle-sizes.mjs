#!/usr/bin/env node
/**
 * next build 出力からページ別バンドルサイズを抽出
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const ROUTES = [
  "/admin/dashboard",
  "/admin/employees",
  "/admin/payroll",
  "/admin/attendance",
  "/admin/stores",
];

function parseBuildOutput() {
  const out = execSync("npm run build 2>&1", { cwd: root, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  const rows = [];
  for (const route of ROUTES) {
    const pattern = new RegExp(`ƒ ${route.replace(/\//g, "\\/")}\\s+(\\S+)\\s+(\\S+)`);
    const m = out.match(pattern);
    if (m) {
      rows.push({ route, size: m[1], firstLoad: m[2] });
    }
  }
  return rows;
}

function main() {
  console.log("=== ページ別 JavaScript バンドル ===\n");
  const rows = parseBuildOutput();
  console.log("| ページ | Route Size | First Load JS |");
  console.log("|--------|------------|---------------|");
  for (const r of rows) {
    console.log(`| ${r.route} | ${r.size} | ${r.firstLoad} |`);
  }

  const empChunk = resolve(root, ".next/static/chunks");
  if (existsSync(empChunk)) {
    console.log("\n※ /admin/employees の 323kB は FaceRegisterModal → @vladmandic/face-api の同期 import が原因");
  }
}

main();
