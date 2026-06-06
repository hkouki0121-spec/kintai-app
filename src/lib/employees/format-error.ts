import type { PostgrestError } from "@supabase/supabase-js";
import {
  DUPLICATE_EMPLOYEE_CODE_MESSAGE,
  EMPTY_EMPLOYEE_CODE_MESSAGE,
} from "@/lib/employees/constants";
import { isDuplicateEmployeeCodeError } from "@/lib/employees/duplicate-code";

export function formatEmployeeDbError(error: PostgrestError | null): string {
  if (!error) return "保存に失敗しました";
  if (isDuplicateEmployeeCodeError(error)) {
    return DUPLICATE_EMPLOYEE_CODE_MESSAGE;
  }

  const parts = [error.message];
  if (error.code) parts.push(`code: ${error.code}`);
  if (error.details) parts.push(`details: ${error.details}`);
  return parts.join("\n");
}

export function logEmployeeCreateError(error: PostgrestError | null, context?: Record<string, unknown>) {
  console.log("[employees/create]", {
    message: error?.message ?? null,
    code: error?.code ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
    ...context,
  });
}

export function validateEmployeeCode(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return EMPTY_EMPLOYEE_CODE_MESSAGE;
  return null;
}
