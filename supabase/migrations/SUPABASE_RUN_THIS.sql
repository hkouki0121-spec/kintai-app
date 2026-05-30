-- ============================================================
-- 複数店舗対応 — Supabase SQL Editor でこのファイルを実行
-- ============================================================

-- 1. 店舗テーブル
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 初期店舗（既存データの紐付け先）
INSERT INTO stores (name, address, phone, is_active)
SELECT '炭火焼肉 笑門来福 本店', NULL, NULL, true
WHERE NOT EXISTS (
  SELECT 1 FROM stores WHERE name = '炭火焼肉 笑門来福 本店'
);

-- 3. 従業員に店舗ID
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);

-- 4. 勤怠に店舗ID
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);

-- 5. 既存データを本店に紐付け
UPDATE employees
SET store_id = (SELECT id FROM stores WHERE name = '炭火焼肉 笑門来福 本店' LIMIT 1)
WHERE store_id IS NULL;

UPDATE attendance_records ar
SET store_id = e.store_id
FROM employees e
WHERE ar.employee_id = e.id
  AND ar.store_id IS NULL
  AND e.store_id IS NOT NULL;

-- 6. NOT NULL 制約
ALTER TABLE employees
  ALTER COLUMN store_id SET NOT NULL;

ALTER TABLE attendance_records
  ALTER COLUMN store_id SET NOT NULL;

-- 7. インデックス
CREATE INDEX IF NOT EXISTS idx_employees_store ON employees(store_id);
CREATE INDEX IF NOT EXISTS idx_attendance_store ON attendance_records(store_id);

-- 8. RLS（店舗テーブル）
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_stores" ON stores;
CREATE POLICY "admin_all_stores" ON stores
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_read_active_stores" ON stores;
CREATE POLICY "anon_read_active_stores" ON stores
  FOR SELECT TO anon USING (is_active = true);

-- 9. 確認（任意）
SELECT id, name, is_active FROM stores ORDER BY name;
