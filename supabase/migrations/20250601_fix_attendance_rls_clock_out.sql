-- 退勤 UPDATE が RLS で拒否されないよう anon ポリシーを再定義
-- Supabase SQL Editor で実行してください

DROP POLICY IF EXISTS "anon_insert_attendance" ON attendance_records;
DROP POLICY IF EXISTS "anon_update_attendance" ON attendance_records;
DROP POLICY IF EXISTS "anon_read_open_attendance" ON attendance_records;

-- キオスク: 未退勤レコードのみ読取
CREATE POLICY "anon_read_open_attendance" ON attendance_records
  FOR SELECT TO anon
  USING (clock_out IS NULL);

-- キオスク: 出勤 INSERT
CREATE POLICY "anon_insert_attendance" ON attendance_records
  FOR INSERT TO anon
  WITH CHECK (clock_out IS NULL);

-- キオスク: 退勤 UPDATE（未退勤レコードのみ、clock_out 設定を許可）
CREATE POLICY "anon_update_attendance" ON attendance_records
  FOR UPDATE TO anon
  USING (clock_out IS NULL)
  WITH CHECK (clock_out IS NOT NULL);
