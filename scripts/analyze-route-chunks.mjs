#!/usr/bin/env node
/**
 * next build 後のルート別 JS チャンクを分析
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

function runBuild() {
  return execSync("npm run build 2>&1", { cwd: root, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
}

function parseRouteSizes(buildOut) {
  const rows = [];
  for (const route of ROUTES) {
    const re = new RegExp(`ƒ ${route.replace(/\//g, "\\/")}\\s+(\\S+)\\s+(\\S+)`);
    const m = buildOut.match(re);
    if (m) rows.push({ route, pageSize: m[1], firstLoad: m[2] });
  }
  return rows;
}

function analyzeChunks() {
  const manifestPath = resolve(root, ".next/app-build-manifest.json");
  if (!existsSync(manifestPath)) return [];
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const pages = manifest.pages ?? {};
  const rows = [];
  for (const route of ROUTES) {
    const files = pages[route] ?? [];
    let total = 0;
    const chunks = [];
    for (const file of files) {
      const p = resolve(root, ".next", file.replace(/^\//, ""));
      if (existsSync(p)) {
        const size = readFileSync(p).length;
        total += size;
        chunks.push({ file: file.split("/").pop(), size });
      }
    }
    rows.push({ route, totalKb: (total / 1024).toFixed(1), chunks: chunks.sort((a, b) => b.size - a.size).slice(0, 5) });
  }
  return rows;
}

function analyzeClientManifest() {
  const path = resolve(root, ".next/build-manifest.json");
  if (!existsSync(path)) return [];
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  const libs = new Map();
  for (const files of Object.values(manifest.pages ?? {})) {
    for (const f of files) {
      if (!f.includes("node_modules") && !f.includes("chunks")) continue;
      const name = f.includes("face-api")
        ? "@vladmandic/face-api"
        : f.includes("react-query")
          ? "@tanstack/react-query"
          : f.split("/").pop();
      libs.set(name, (libs.get(name) ?? 0) + 1);
    }
  }
  return [...libs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
}

console.log("Building...\n");
const buildOut = runBuild();
const routes = parseRouteSizes(buildOut);
const chunks = analyzeChunks();

console.log("=== ① ページ別 First Load JS ===\n");
console.log("| ページ | Page JS | First Load |");
console.log("|--------|---------|------------|");
for (const r of routes) {
  console.log(`| ${r.route} | ${r.pageSize} | ${r.firstLoad} |`);
}

const heaviest = [...routes].sort((a, b) => parseFloat(b.firstLoad) - parseFloat(a.firstLoad))[0];
console.log(`\n最も重いページ: ${heaviest?.route} (First Load ${heaviest?.firstLoad})`);

console.log("\n=== ② ルート別チャンク（build manifest）===\n");
for (const c of chunks) {
  console.log(`${c.route}: ${c.totalKb} kB`);
  for (const ch of c.chunks) {
    console.log(`  - ${ch.file}: ${(ch.size / 1024).toFixed(1)} kB`);
  }
}

console.log("\n=== ⑦ 重いライブラリ（チャンク出現）===");
for (const [name, count] of analyzeClientManifest()) {
  console.log(`  ${name}: ${count} chunks`);
}
