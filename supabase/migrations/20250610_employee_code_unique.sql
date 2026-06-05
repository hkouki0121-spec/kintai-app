-- 社員コード重複検出 + 会社内ユニーク制約
--
-- 【手順】
-- 1. 下記「重複検出クエリ」を実行し、結果が 0 件であることを確認
-- 2. 重複がある場合は社員コードを修正してから 3 へ
-- 3. 制約追加ブロックを実行

-- ============================================================
-- 重複検出クエリ（結果が 1 行以上なら制約追加前に修正が必要）
-- ============================================================
-- SELECT
--   c.name AS company_name,
--   e.company_id,
--   e.employee_code,
--   COUNT(*) AS duplicate_count,
--   array_agg(e.name ORDER BY e.name) AS employee_names,
--   array_agg(e.id ORDER BY e.name) AS employee_ids
-- FROM employees e
-- JOIN companies c ON c.id = e.company_id
-- GROUP BY c.name, e.company_id, e.employee_code
-- HAVING COUNT(*) > 1
-- ORDER BY c.name, e.employee_code;

-- 旧: 全社共通ユニーク（あれば削除）
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_employee_code_key;

-- 会社内ユニーク（company_id + employee_code）
CREATE UNIQUE INDEX IF NOT EXISTS uniq_employees_company_code
  ON employees(company_id, employee_code);
