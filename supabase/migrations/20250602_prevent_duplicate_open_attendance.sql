-- 同一従業員の未退勤レコード重複を防止
-- Supabase SQL Editor で実行してください

-- 1. 既存の重複未退勤を整理（最新 clock_in 以外を締める）
WITH ranked AS (
  SELECT
    id,
    clock_in,
    ROW_NUMBER() OVER (PARTITION BY employee_id ORDER BY clock_in DESC) AS rn
  FROM public.attendance_records
  WHERE clock_out IS NULL
)
UPDATE public.attendance_records ar
SET clock_out = GREATEST(r.clock_in + interval '1 second', now())
FROM ranked r
WHERE ar.id = r.id
  AND r.rn > 1;

-- 2. 従業員あたり未退勤1件の部分ユニーク制約
CREATE UNIQUE INDEX IF NOT EXISTS uniq_attendance_one_open_per_employee
  ON public.attendance_records (employee_id)
  WHERE clock_out IS NULL;

-- 3. 退勤 UPDATE の RLS（WITH CHECK を明示）
DROP POLICY IF EXISTS "anon_update_attendance" ON public.attendance_records;

CREATE POLICY "anon_update_attendance"
  ON public.attendance_records
  FOR UPDATE
  TO anon
  USING (clock_out IS NULL)
  WITH CHECK (true);
