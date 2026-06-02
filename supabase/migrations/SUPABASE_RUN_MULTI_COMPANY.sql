-- ============================================================
-- 複数会社対応 — Supabase Dashboard → SQL Editor で実行
-- ファイル: supabase/migrations/20250608_multi_company.sql と同内容
-- ============================================================

-- 複数会社対応

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

-- 既存データ用デフォルト会社
INSERT INTO companies (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', '初期会社')
ON CONFLICT (id) DO NOTHING;

-- stores
ALTER TABLE stores ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
UPDATE stores SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
ALTER TABLE stores ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stores_company ON stores(company_id);

-- line_groups
ALTER TABLE line_groups ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_line_groups_company ON line_groups(company_id);

-- employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
UPDATE employees e
SET company_id = s.company_id
FROM stores s
WHERE e.store_id = s.id AND e.company_id IS NULL;
ALTER TABLE employees ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_employee_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_employees_company_code ON employees(company_id, employee_code);

-- attendance_records
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
UPDATE attendance_records ar
SET company_id = s.company_id
FROM stores s
WHERE ar.store_id = s.id AND ar.company_id IS NULL;
ALTER TABLE attendance_records ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_company ON attendance_records(company_id);

-- monthly_payroll
ALTER TABLE monthly_payroll ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
UPDATE monthly_payroll mp
SET company_id = e.company_id
FROM employees e
WHERE mp.employee_id = e.id AND mp.company_id IS NULL;
ALTER TABLE monthly_payroll ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payroll_company ON monthly_payroll(company_id);

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

-- Enable RLS on new tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companies_select ON companies;
CREATE POLICY companies_select ON companies
  FOR SELECT TO authenticated
  USING (public.auth_can_access_company(id));

DROP POLICY IF EXISTS companies_super_admin_write ON companies;
CREATE POLICY companies_super_admin_write ON companies
  FOR ALL TO authenticated
  USING (public.auth_is_super_admin())
  WITH CHECK (public.auth_is_super_admin());

DROP POLICY IF EXISTS company_members_select ON company_members;
CREATE POLICY company_members_select ON company_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.auth_is_super_admin());

DROP POLICY IF EXISTS company_members_super_admin_write ON company_members;
CREATE POLICY company_members_super_admin_write ON company_members
  FOR ALL TO authenticated
  USING (public.auth_is_super_admin())
  WITH CHECK (public.auth_is_super_admin());

-- Replace global admin policies with company-scoped policies
DROP POLICY IF EXISTS admin_all_stores ON stores;
DROP POLICY IF EXISTS company_stores ON stores;
CREATE POLICY company_stores ON stores
  FOR ALL TO authenticated
  USING (public.auth_can_access_company(company_id))
  WITH CHECK (public.auth_can_access_company(company_id));

DROP POLICY IF EXISTS admin_all_line_groups ON line_groups;
DROP POLICY IF EXISTS company_line_groups ON line_groups;
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

DROP POLICY IF EXISTS admin_all_employees ON employees;
DROP POLICY IF EXISTS company_employees ON employees;
CREATE POLICY company_employees ON employees
  FOR ALL TO authenticated
  USING (public.auth_can_access_company(company_id))
  WITH CHECK (public.auth_can_access_company(company_id));

DROP POLICY IF EXISTS admin_all_attendance ON attendance_records;
DROP POLICY IF EXISTS company_attendance ON attendance_records;
CREATE POLICY company_attendance ON attendance_records
  FOR ALL TO authenticated
  USING (public.auth_can_access_company(company_id))
  WITH CHECK (public.auth_can_access_company(company_id));

DROP POLICY IF EXISTS admin_all_attendance_corrections ON attendance_corrections;
DROP POLICY IF EXISTS company_attendance_corrections ON attendance_corrections;
CREATE POLICY company_attendance_corrections ON attendance_corrections
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM attendance_records ar
      WHERE ar.id = attendance_record_id
        AND public.auth_can_access_company(ar.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM attendance_records ar
      WHERE ar.id = attendance_record_id
        AND public.auth_can_access_company(ar.company_id)
    )
  );

DROP POLICY IF EXISTS admin_all_payroll ON monthly_payroll;
DROP POLICY IF EXISTS company_payroll ON monthly_payroll;
CREATE POLICY company_payroll ON monthly_payroll
  FOR ALL TO authenticated
  USING (public.auth_can_access_company(company_id))
  WITH CHECK (public.auth_can_access_company(company_id));

-- 既存の Supabase Auth ユーザーを初期会社の管理者として紐付け
INSERT INTO company_members (user_id, company_id, role)
SELECT u.id, '00000000-0000-0000-0000-000000000001', 'company_admin'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM company_members cm WHERE cm.user_id = u.id
);

-- 確認
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'companies'
ORDER BY ordinal_position;
