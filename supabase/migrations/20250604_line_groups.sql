-- LINE グループ一覧（Webhook で Bot 参加グループを自動登録）
-- Supabase SQL Editor で実行してください

CREATE TABLE IF NOT EXISTS public.line_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id TEXT NOT NULL UNIQUE,
  group_name TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_line_groups_last_seen ON public.line_groups(last_seen_at DESC);

ALTER TABLE public.line_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_line_groups" ON public.line_groups;
CREATE POLICY "admin_all_line_groups" ON public.line_groups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.line_groups TO authenticated;
