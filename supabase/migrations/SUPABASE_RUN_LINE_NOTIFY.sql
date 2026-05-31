-- LINE 店舗別通知を有効化する SQL
-- Supabase SQL Editor で実行してください

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS manager_name TEXT,
  ADD COLUMN IF NOT EXISTS line_user_id TEXT,
  ADD COLUMN IF NOT EXISTS line_group_id TEXT,
  ADD COLUMN IF NOT EXISTS line_notify_enabled BOOLEAN NOT NULL DEFAULT false;

-- 確認
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'stores'
  AND column_name IN (
    'manager_name',
    'line_user_id',
    'line_group_id',
    'line_notify_enabled'
  )
ORDER BY column_name;
