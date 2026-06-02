import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { CompanyContext } from "@/lib/auth/company-context";
import { getCompanyContext } from "@/lib/auth/company-context";
import { serializeSupabaseError } from "@/lib/attendance/api-errors";

export type AttendanceAdminErrorDetails = {
  code?: string | null;
  details?: string | null;
  denialStep?: string;
  debug?: Record<string, unknown>;
};

export class AttendanceAdminError extends Error {
  status: number;
  code: string | null;
  details: string | null;
  denialStep: string | null;
  debug: Record<string, unknown> | null;

  constructor(message: string, status: number, extra?: AttendanceAdminErrorDetails) {
    super(message);
    this.status = status;
    this.code = extra?.code ?? null;
    this.details = extra?.details ?? null;
    this.denialStep = extra?.denialStep ?? null;
    this.debug = extra?.debug ?? null;
  }

  toPayload() {
    return {
      error: this.message,
      message: this.message,
      code: this.code,
      details: this.details,
      denialStep: this.denialStep,
      ...(this.debug ? { debug: this.debug } : {}),
    };
  }
}

function fromSupabaseError(
  error: PostgrestError,
  status: number,
  summary: string,
  denialStep: string,
  debug?: Record<string, unknown>
): AttendanceAdminError {
  const serialized = serializeSupabaseError(error);
  return new AttendanceAdminError(summary, status, {
    code: serialized.code,
    details: serialized.details,
    denialStep,
    debug,
  });
}

/** 勤怠修正は管理者（company_admin / super_admin）のみ */
export async function requireAttendanceAdmin(
  supabase: SupabaseClient
): Promise<CompanyContext> {
  const context = await getCompanyContext(supabase);
  if (!context) {
    throw new AttendanceAdminError("ログインセッションが無効です。再度ログインしてください。", 401, {
      denialStep: "require_admin",
    });
  }
  return context;
}

/**
 * RLS で参照可能な勤怠記録かどうかで権限を判定する。
 * company_id の厳密一致は使わない（レガシーデータで admin と employee の company_id が異なる場合がある）。
 */
export async function assertAttendanceRecordAccess(
  supabase: SupabaseClient,
  context: CompanyContext,
  recordId: string
): Promise<{
  id: string;
  company_id: string;
  employee_id: string;
  store_id: string;
  clock_in: string;
  clock_out: string | null;
}> {
  const { data: record, error } = await supabase
    .from("attendance_records")
    .select("id, company_id, employee_id, store_id, clock_in, clock_out")
    .eq("id", recordId)
    .maybeSingle();

  if (error) {
    throw fromSupabaseError(error, 500, "勤怠記録の取得に失敗しました", "attendance_record_rls_select", {
      recordId,
      adminCompanyId: context.companyId,
      adminRole: context.role,
    });
  }
  if (!record) {
    throw new AttendanceAdminError("勤怠記録が見つかりません", 404, {
      denialStep: "attendance_record_not_visible",
      debug: {
        recordId,
        adminCompanyId: context.companyId,
        adminRole: context.role,
        adminUserId: context.userId,
      },
    });
  }

  return record;
}

/**
 * RLS で参照可能な従業員かどうかで権限を判定する。
 * 従業員一覧に表示されている = この SELECT が成功する、という前提に合わせる。
 */
export async function assertEmployeeAccess(
  supabase: SupabaseClient,
  context: CompanyContext,
  employeeId: string
): Promise<{ id: string; company_id: string; store_id: string; name: string }> {
  const { data: visibleEmployees, error: listError } = await supabase
    .from("employees")
    .select("id");

  if (listError) {
    throw fromSupabaseError(listError, 500, "従業員一覧の取得に失敗しました", "employee_list_rls_select", {
      employeeId,
      adminCompanyId: context.companyId,
      adminRole: context.role,
    });
  }

  const canAccessEmployee = (visibleEmployees ?? []).some((row) => row.id === employeeId);

  const { data: employee, error } = await supabase
    .from("employees")
    .select("id, company_id, store_id, name")
    .eq("id", employeeId)
    .maybeSingle();

  const debug = {
    employeeId,
    adminCompanyId: context.companyId,
    adminRole: context.role,
    adminUserId: context.userId,
    employeeCompanyId: employee?.company_id ?? null,
    employeeStoreId: employee?.store_id ?? null,
    canAccessEmployee,
    visibleEmployeeCount: visibleEmployees?.length ?? 0,
    companyIdMatchesAdmin:
      employee?.company_id != null &&
      context.companyId != null &&
      employee.company_id === context.companyId,
  };

  if (error) {
    throw fromSupabaseError(error, 500, "従業員情報の取得に失敗しました", "employee_rls_select", debug);
  }

  if (!employee || !canAccessEmployee) {
    throw new AttendanceAdminError(
      canAccessEmployee
        ? "従業員が見つかりません"
        : "この従業員の勤怠を登録する権限がありません",
      canAccessEmployee ? 404 : 403,
      {
        denialStep: canAccessEmployee ? "employee_not_found" : "employee_not_in_visible_list",
        debug,
      }
    );
  }

  if (!context.isSuperAdmin && employee.company_id !== context.companyId) {
    console.warn("[attendance/manual-create] company_id mismatch (RLS allowed access)", debug);
  }

  return employee;
}
