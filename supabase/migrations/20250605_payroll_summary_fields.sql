-- 月次給与に出勤日数・総勤務時間・残業時間を追加
ALTER TABLE monthly_payroll
  ADD COLUMN IF NOT EXISTS attendance_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_total_hours NUMERIC(10, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(10, 4) NOT NULL DEFAULT 0;
