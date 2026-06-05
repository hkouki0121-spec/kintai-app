-- 自動バックアップ: Storage バケット + メタデータテーブル

CREATE TABLE IF NOT EXISTS backup_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  backup_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  files JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, backup_date)
);

CREATE INDEX IF NOT EXISTS idx_backup_runs_company_date
  ON backup_runs(company_id, backup_date DESC);

ALTER TABLE backup_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS backup_runs_select ON backup_runs;
CREATE POLICY backup_runs_select ON backup_runs
  FOR SELECT TO authenticated
  USING (public.auth_can_access_company(company_id));

GRANT SELECT ON backup_runs TO authenticated;
GRANT ALL ON backup_runs TO service_role;

-- Storage バケット（非公開・CSV のみ）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'backups',
  'backups',
  false,
  NULL,
  ARRAY['text/csv', 'application/csv', 'text/plain']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.auth_can_access_backup_path(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.auth_is_super_admin()
    OR (storage.foldername(object_name))[1] = public.auth_user_company_id()::text;
$$;

GRANT EXECUTE ON FUNCTION public.auth_can_access_backup_path(text) TO authenticated;

DROP POLICY IF EXISTS backups_select ON storage.objects;
CREATE POLICY backups_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'backups'
    AND public.auth_can_access_backup_path(name)
  );

-- 管理者によるバックアップファイルの削除は不可（DELETE ポリシーなし）
-- INSERT/UPDATE も service_role のみ（cron / API サーバー側）
