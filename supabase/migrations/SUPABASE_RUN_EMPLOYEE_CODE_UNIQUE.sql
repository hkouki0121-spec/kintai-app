-- Supabase SQL Editor で手動実行用
-- 1. 重複検出 → 2. 重複修正 → 3. 制約追加

-- 【1】重複検出（1 行以上あれば修正が必要）
SELECT
  c.name AS company_name,
  e.company_id,
  e.employee_code,
  COUNT(*) AS duplicate_count,
  array_agg(e.name ORDER BY e.name) AS employee_names,
  array_agg(e.id ORDER BY e.name) AS employee_ids
FROM employees e
JOIN companies c ON c.id = e.company_id
GROUP BY c.name, e.company_id, e.employee_code
HAVING COUNT(*) > 1
ORDER BY c.name, e.employee_code;

-- 【2】重複が 0 件になったら実行
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_employee_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_employees_company_code
  ON employees(company_id, employee_code);
