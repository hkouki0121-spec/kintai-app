import type { PostgrestError } from "@supabase/supabase-js";

export type AttendanceErrorPayload = {
  error: string;
  message: string;
  code: string | null;
  details: string | null;
  denialStep?: string | null;
  debug?: Record<string, unknown>;
};

export function serializeSupabaseError(error: PostgrestError | null | undefined) {
  return {
    message: error?.message ?? null,
    code: error?.code ?? null,
    details: error?.details ?? null,
  };
}

export function buildAttendanceErrorPayload(
  summary: string,
  source?: {
    message?: string | null;
    code?: string | null;
    details?: string | null;
    denialStep?: string | null;
  },
  debug?: Record<string, unknown>
): AttendanceErrorPayload {
  return {
    error: summary,
    message: source?.message ?? summary,
    code: source?.code ?? null,
    details: source?.details ?? null,
    denialStep: source?.denialStep ?? null,
    ...(debug ? { debug } : {}),
  };
}

export function logAttendanceManualCreate(label: string, payload: Record<string, unknown>) {
  console.log(`[attendance/manual-create] ${label}`, JSON.stringify(payload, null, 2));
}
