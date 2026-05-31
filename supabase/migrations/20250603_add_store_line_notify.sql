-- 店舗別 LINE 通知設定
-- Supabase SQL Editor で実行してください

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS manager_name TEXT,
  ADD COLUMN IF NOT EXISTS line_user_id TEXT,
  ADD COLUMN IF NOT EXISTS line_group_id TEXT,
  ADD COLUMN IF NOT EXISTS line_notify_enabled BOOLEAN NOT NULL DEFAULT false;
