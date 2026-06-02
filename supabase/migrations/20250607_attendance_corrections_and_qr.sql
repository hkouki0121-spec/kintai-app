-- QR打刻フラグ
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS is_qr_clock BOOLEAN NOT NULL DEFAULT false;

-- 店舗QRトークン（ハッシュのみ保存）
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS qr_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS qr_token_updated_at TIMESTAMPTZ;

-- 勤怠修正履歴
CREATE TABLE IF NOT EXISTS attendance_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id UUID NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  corrector_user_id UUID,
  corrector_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  clock_in_before TIMESTAMPTZ,
  clock_in_after TIMESTAMPTZ,
  clock_out_before TIMESTAMPTZ,
  clock_out_after TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_corrections_record
  ON attendance_corrections(attendance_record_id);

ALTER TABLE attendance_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_attendance_corrections ON attendance_corrections;
CREATE POLICY admin_all_attendance_corrections ON attendance_corrections
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
