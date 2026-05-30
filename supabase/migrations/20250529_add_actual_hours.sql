-- 既存DB向け: 実勤務時間カラムの追加
-- regular_hours / night_hours は給与計算時間（30分切り捨て後）として利用

ALTER TABLE monthly_payroll
  ADD COLUMN IF NOT EXISTS actual_regular_hours NUMERIC(10, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_night_hours NUMERIC(10, 4) NOT NULL DEFAULT 0;
