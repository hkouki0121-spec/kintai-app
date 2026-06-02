-- 勤怠管理アプリ データベーススキーマ
-- Supabase SQL Editor で実行してください

-- 会社
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 管理者と会社の紐付け
CREATE TABLE IF NOT EXISTS company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'company_admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT company_admin_requires_company CHECK (
    role = 'super_admin' OR company_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_company_members_user ON company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company ON company_members(company_id);

-- 店舗
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  manager_name TEXT,
  line_user_id TEXT,
  line_group_id TEXT,
  line_notify_enabled BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  qr_token_hash TEXT,
  qr_token_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stores_company ON stores(company_id);

-- LINE Bot が参加しているグループ（Webhook で自動登録）
CREATE TABLE IF NOT EXISTS line_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id TEXT NOT NULL UNIQUE,
  group_name TEXT,
  company_id UUID REFERENCES companies(id),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_line_groups_last_seen ON line_groups(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_line_groups_company ON line_groups(company_id);

-- 従業員
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  employee_code TEXT NOT NULL,
  store_id UUID NOT NULL REFERENCES stores(id),
  hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 1000 CHECK (hourly_rate > 0),
  face_descriptor JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_store ON employees(store_id);
CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_employees_company_code ON employees(company_id, employee_code);

-- 勤怠記録
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id),
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  is_qr_clock BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clock_out_after_in CHECK (clock_out IS NULL OR clock_out > clock_in)
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_store ON attendance_records(store_id);
CREATE INDEX IF NOT EXISTS idx_attendance_company ON attendance_records(company_id);
CREATE INDEX IF NOT EXISTS idx_attendance_clock_in ON attendance_records(clock_in DESC);

-- 勤怠修正履歴（削除不可・参照・追加のみ）
CREATE TABLE IF NOT EXISTS attendance_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id UUID NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id),
  company_id UUID REFERENCES companies(id),
  store_id UUID REFERENCES stores(id),
  before_clock_in TIMESTAMPTZ,
  before_clock_out TIMESTAMPTZ,
  after_clock_in TIMESTAMPTZ,
  after_clock_out TIMESTAMPTZ,
  reason TEXT NOT NULL,
  corrected_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_corrections_record
  ON attendance_corrections(attendance_record_id);
CREATE INDEX IF NOT EXISTS idx_attendance_corrections_employee
  ON attendance_corrections(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_corrections_company
  ON attendance_corrections(company_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_attendance_one_open_per_employee
  ON attendance_records (employee_id)
  WHERE clock_out IS NULL;

-- 月次給与
CREATE TABLE IF NOT EXISTS monthly_payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  actual_regular_hours NUMERIC(10, 4) NOT NULL DEFAULT 0,
  actual_night_hours NUMERIC(10, 4) NOT NULL DEFAULT 0,
  actual_total_hours NUMERIC(10, 4) NOT NULL DEFAULT 0,
  attendance_days INTEGER NOT NULL DEFAULT 0,
  overtime_hours NUMERIC(10, 4) NOT NULL DEFAULT 0,
  regular_hours NUMERIC(10, 4) NOT NULL DEFAULT 0,
  night_hours NUMERIC(10, 4) NOT NULL DEFAULT 0,
  regular_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  night_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_payroll_period ON monthly_payroll(year, month);
CREATE INDEX IF NOT EXISTS idx_payroll_company ON monthly_payroll(company_id);

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

-- RLS helper functions
CREATE OR REPLACE FUNCTION public.auth_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_members
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM company_members
  WHERE user_id = auth.uid() AND role = 'company_admin'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.auth_can_access_company(target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_is_super_admin()
    OR public.auth_user_company_id() = target;
$$;

GRANT EXECUTE ON FUNCTION public.auth_is_super_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.auth_user_company_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.auth_can_access_company(uuid) TO authenticated, anon;

-- RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_payroll ENABLE ROW LEVEL SECURITY;

CREATE POLICY companies_select ON companies
  FOR SELECT TO authenticated
  USING (public.auth_can_access_company(id));

CREATE POLICY companies_super_admin_write ON companies
  FOR ALL TO authenticated
  USING (public.auth_is_super_admin())
  WITH CHECK (public.auth_is_super_admin());

CREATE POLICY company_members_select ON company_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.auth_is_super_admin());

CREATE POLICY company_members_super_admin_write ON company_members
  FOR ALL TO authenticated
  USING (public.auth_is_super_admin())
  WITH CHECK (public.auth_is_super_admin());

CREATE POLICY company_stores ON stores
  FOR ALL TO authenticated
  USING (public.auth_can_access_company(company_id))
  WITH CHECK (public.auth_can_access_company(company_id));

CREATE POLICY company_line_groups ON line_groups
  FOR ALL TO authenticated
  USING (
    public.auth_is_super_admin()
    OR company_id IS NULL
    OR public.auth_can_access_company(company_id)
  )
  WITH CHECK (
    public.auth_is_super_admin()
    OR company_id IS NULL
    OR public.auth_can_access_company(company_id)
  );

CREATE POLICY company_employees ON employees
  FOR ALL TO authenticated
  USING (public.auth_can_access_company(company_id))
  WITH CHECK (public.auth_can_access_company(company_id));

CREATE POLICY company_attendance ON attendance_records
  FOR ALL TO authenticated
  USING (public.auth_can_access_company(company_id))
  WITH CHECK (public.auth_can_access_company(company_id));

CREATE POLICY company_attendance_corrections_select ON attendance_corrections
  FOR SELECT TO authenticated
  USING (
    public.auth_can_access_company(company_id)
    OR EXISTS (
      SELECT 1 FROM attendance_records ar
      WHERE ar.id = attendance_record_id
        AND public.auth_can_access_company(ar.company_id)
    )
  );

CREATE POLICY company_attendance_corrections_insert ON attendance_corrections
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_can_access_company(company_id)
    OR EXISTS (
      SELECT 1 FROM attendance_records ar
      WHERE ar.id = attendance_record_id
        AND public.auth_can_access_company(ar.company_id)
    )
  );

CREATE POLICY company_payroll ON monthly_payroll
  FOR ALL TO authenticated
  USING (public.auth_can_access_company(company_id))
  WITH CHECK (public.auth_can_access_company(company_id));

CREATE POLICY anon_read_active_stores ON stores
  FOR SELECT TO anon USING (is_active = true);

CREATE POLICY anon_read_active_employees ON employees
  FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY anon_insert_attendance ON attendance_records
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY anon_update_attendance ON attendance_records
  FOR UPDATE TO anon USING (clock_out IS NULL) WITH CHECK (true);

CREATE POLICY anon_read_open_attendance ON attendance_records
  FOR SELECT TO anon USING (clock_out IS NULL);
