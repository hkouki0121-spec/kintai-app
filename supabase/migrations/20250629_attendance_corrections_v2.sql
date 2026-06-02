-- 勤怠修正履歴テーブルを要件どおりのカラム構成に更新（修正履歴は削除不可）

ALTER TABLE attendance_corrections
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id),
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id),
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id),
  ADD COLUMN IF NOT EXISTS before_clock_in TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS before_clock_out TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS after_clock_in TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS after_clock_out TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS corrected_by UUID;

-- 旧カラムからデータ移行
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'attendance_corrections'
      AND column_name = 'clock_in_before'
  ) THEN
    UPDATE attendance_corrections SET
      before_clock_in = COALESCE(before_clock_in, clock_in_before),
      before_clock_out = COALESCE(before_clock_out, clock_out_before),
      after_clock_in = COALESCE(after_clock_in, clock_in_after),
      after_clock_out = COALESCE(after_clock_out, clock_out_after),
      corrected_by = COALESCE(corrected_by, corrector_user_id);
  END IF;
END $$;

UPDATE attendance_corrections ac
SET
  employee_id = COALESCE(ac.employee_id, ar.employee_id),
  company_id = COALESCE(ac.company_id, ar.company_id),
  store_id = COALESCE(ac.store_id, ar.store_id)
FROM attendance_records ar
WHERE ar.id = ac.attendance_record_id
  AND (ac.employee_id IS NULL OR ac.company_id IS NULL OR ac.store_id IS NULL);

ALTER TABLE attendance_corrections DROP COLUMN IF EXISTS corrector_user_id;
ALTER TABLE attendance_corrections DROP COLUMN IF EXISTS corrector_name;
ALTER TABLE attendance_corrections DROP COLUMN IF EXISTS clock_in_before;
ALTER TABLE attendance_corrections DROP COLUMN IF EXISTS clock_in_after;
ALTER TABLE attendance_corrections DROP COLUMN IF EXISTS clock_out_before;
ALTER TABLE attendance_corrections DROP COLUMN IF EXISTS clock_out_after;

CREATE INDEX IF NOT EXISTS idx_attendance_corrections_employee
  ON attendance_corrections(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_corrections_company
  ON attendance_corrections(company_id);

-- 修正履歴は参照・追加のみ（削除・更新不可）
DROP POLICY IF EXISTS company_attendance_corrections ON attendance_corrections;
DROP POLICY IF EXISTS admin_all_attendance_corrections ON attendance_corrections;
DROP POLICY IF EXISTS company_attendance_corrections_select ON attendance_corrections;
DROP POLICY IF EXISTS company_attendance_corrections_insert ON attendance_corrections;

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
