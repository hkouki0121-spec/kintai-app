-- ============================================================
-- 会社登録・ログイン後のアクセス修復用
-- companies / company_members テーブル作成後に RLS だけ未適用の場合に実行
-- Supabase Dashboard → SQL Editor
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_members TO authenticated;
GRANT ALL ON public.companies TO service_role;
GRANT ALL ON public.company_members TO service_role;

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

GRANT EXECUTE ON FUNCTION public.auth_is_super_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.auth_user_company_id() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.auth_can_access_company(uuid) TO authenticated, anon, service_role;

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

-- 確認
SELECT proname FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('auth_is_super_admin', 'auth_user_company_id', 'auth_can_access_company');
