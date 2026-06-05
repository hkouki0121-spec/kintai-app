export type PayrollRoundingMinutes = 1 | 15 | 30;

export const PAYROLL_ROUNDING_OPTIONS: { value: PayrollRoundingMinutes; label: string }[] = [
  { value: 1, label: "1分単位" },
  { value: 15, label: "15分単位" },
  { value: 30, label: "30分単位" },
];

export const DEFAULT_PAYROLL_ROUNDING_MINUTES: PayrollRoundingMinutes = 30;

export function normalizePayrollRoundingMinutes(value: unknown): PayrollRoundingMinutes {
  const num = Number(value);
  if (num === 1 || num === 15 || num === 30) return num;
  return DEFAULT_PAYROLL_ROUNDING_MINUTES;
}

export type PayrollSettings = {
  roundingMinutes: PayrollRoundingMinutes;
};

export function getPayrollSettings(roundingMinutes?: number | null): PayrollSettings {
  return { roundingMinutes: normalizePayrollRoundingMinutes(roundingMinutes) };
}
