ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS payroll_rounding_minutes INTEGER NOT NULL DEFAULT 30
  CHECK (payroll_rounding_minutes IN (1, 15, 30));
