-- 退勤 UPDATE 後の .select() 不要化に合わせ、anon ポリシーを true に統一
-- （本番で WITH CHECK (clock_out IS NOT NULL) 等がある場合は上書き）

DROP POLICY IF EXISTS "anon_insert_attendance" ON attendance_records;
DROP POLICY IF EXISTS "anon_update_attendance" ON attendance_records;
DROP POLICY IF EXISTS "anon_read_open_attendance" ON attendance_records;

CREATE POLICY "anon_read_open_attendance" ON attendance_records
  FOR SELECT TO anon
  USING (clock_out IS NULL);

CREATE POLICY "anon_insert_attendance" ON attendance_records
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "anon_update_attendance" ON attendance_records
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);
