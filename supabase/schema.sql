-- 勤怠管理アプリ データベーススキーマ
-- Supabase SQL Editor で実行してください

-- 店舗
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  manager_name TEXT,
  line_user_id TEXT,
  line_group_id TEXT,
  line_notify_enabled BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 従業員
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  employee_code TEXT NOT NULL UNIQUE,
  store_id UUID NOT NULL REFERENCES stores(id),
  hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 1000 CHECK (hourly_rate > 0),
  face_descriptor JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_store ON employees(store_id);

-- 勤怠記録
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id),
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clock_out_after_in CHECK (clock_out IS NULL OR clock_out > clock_in)
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_store ON attendance_records(store_id);
CREATE INDEX IF NOT EXISTS idx_attendance_clock_in ON attendance_records(clock_in DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_attendance_one_open_per_employee
  ON attendance_records (employee_id)
  WHERE clock_out IS NULL;

-- 月次給与
CREATE TABLE IF NOT EXISTS monthly_payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  actual_regular_hours NUMERIC(10, 4) NOT NULL DEFAULT 0,
  actual_night_hours NUMERIC(10, 4) NOT NULL DEFAULT 0,
  regular_hours NUMERIC(10, 4) NOT NULL DEFAULT 0,
  night_hours NUMERIC(10, 4) NOT NULL DEFAULT 0,
  regular_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  night_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_payroll_period ON monthly_payroll(year, month);

-- updated_at トリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS employees_updated_at ON employees;
CREATE TRIGGER employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_payroll ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_stores" ON stores
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "admin_all_employees" ON employees
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "admin_all_attendance" ON attendance_records
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "admin_all_payroll" ON monthly_payroll
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_active_stores" ON stores
  FOR SELECT TO anon USING (is_active = true);

CREATE POLICY "anon_read_active_employees" ON employees
  FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "anon_insert_attendance" ON attendance_records
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update_attendance" ON attendance_records
  FOR UPDATE TO anon USING (clock_out IS NULL) WITH CHECK (true);

CREATE POLICY "anon_read_open_attendance" ON attendance_records
  FOR SELECT TO anon USING (clock_out IS NULL);
