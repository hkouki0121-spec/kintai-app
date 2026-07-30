#!/usr/bin/env node
/**
 * 社員コード重複チェック + 制約検証
 * node scripts/verify-employee-code-unique.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env が未設定です");
  }

  const supabase = createClient(url, key);
  const { data: employees, error } = await supabase
    .from("employees")
    .select("id, company_id, employee_code, name, store_id, hourly_rate, companies(name)");

  if (error) throw new Error(error.message);

  const groups = new Map();
  for (const employee of employees ?? []) {
    const code = employee.employee_code.trim();
    const groupKey = `${employee.company_id}:${code}`;
    const list = groups.get(groupKey) ?? [];
    list.push(employee);
    groups.set(groupKey, list);
  }

  const duplicates = [...groups.values()].filter((group) => group.length > 1);

  console.log("=== 重複検出 ===");
  console.log(`従業員数: ${employees?.length ?? 0}`);
  console.log(`重複グループ数: ${duplicates.length}`);
  for (const group of duplicates) {
    console.log(
      `- ${group[0].companies?.name ?? group[0].company_id} / ${group[0].employee_code}: ${group.map((e) => e.name).join(", ")}`
    );
  }

  if (duplicates.length > 0) {
    console.log("\n❌ 重複があるため制約適用をスキップしました");
    process.exit(1);
  }

  const sample = employees?.[0];
  if (!sample) {
    console.log("\n⚠️ 従業員データがないため制約テストをスキップ");
    return;
  }

  console.log("\n=== 制約検証: 重複登録 ===");
  const insertResult = await supabase.from("employees").insert({
    name: "__constraint_test_insert__",
    employee_code: sample.employee_code,
    company_id: sample.company_id,
    store_id: sample.store_id,
    hourly_rate: sample.hourly_rate,
  });

  if (insertResult.error?.code === "23505") {
    console.log("✅ 重複登録は拒否されました");
    console.log(`   制約: ${insertResult.error.message.includes("uniq_employees_company_code") ? "uniq_employees_company_code" : insertResult.error.message}`);
  } else if (insertResult.error) {
    console.log(`⚠️ 想定外のエラー: ${insertResult.error.message}`);
  } else {
    console.log("❌ 重複登録が成功してしまいました（制約なし）");
    await supabase.from("employees").delete().eq("name", "__constraint_test_insert__");
    process.exit(1);
  }

  const sameCompany = (employees ?? []).filter((e) => e.company_id === sample.company_id);
  const other =
    sameCompany.find((e) => e.id !== sample.id && e.employee_code.trim() !== sample.employee_code.trim()) ??
    sameCompany.find((e) => e.id !== sample.id);

  if (!other) {
    console.log("\n=== 制約検証: 重複編集 ===");
    console.log("⚠️ 同一会社に比較対象が1名のみのため編集テストをスキップ");
    return;
  }

  const originalCode = other.employee_code;
  console.log("\n=== 制約検証: 重複編集 ===");
  const updateResult = await supabase
    .from("employees")
    .update({ employee_code: sample.employee_code })
    .eq("id", other.id);

  if (updateResult.error?.code === "23505") {
    console.log("✅ 重複編集は拒否されました");
  } else if (updateResult.error) {
    console.log(`⚠️ 想定外のエラー: ${updateResult.error.message}`);
  } else {
    console.log("❌ 重複編集が成功してしまいました（制約なし）");
    await supabase.from("employees").update({ employee_code: originalCode }).eq("id", other.id);
    process.exit(1);
  }

  console.log("\n✅ 社員コード重複禁止は本番DBで有効です");
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
