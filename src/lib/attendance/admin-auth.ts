import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompanyContext } from "@/lib/auth/company-context";
import { getCompanyContext } from "@/lib/auth/company-context";

export class AttendanceAdminError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** 勤怠修正は管理者（company_admin / super_admin）のみ */
export async function requireAttendanceAdmin(
  supabase: SupabaseClient
): Promise<CompanyContext> {
  const context = await getCompanyContext(supabase);
  if (!context) {
    throw new AttendanceAdminError("ログインセッションが無効です。再度ログインしてください。", 401);
  }
  return context;
}

export async function assertAttendanceRecordAccess(
  supabase: SupabaseClient,
  context: CompanyContext,
  recordId: string
): Promise<{ id: string; company_id: string; employee_id: string; store_id: string; clock_in: string; clock_out: string | null }> {
  const { data: record, error } = await supabase
    .from("attendance_records")
    .select("id, company_id, employee_id, store_id, clock_in, clock_out")
    .eq("id", recordId)
    .maybeSingle();

  if (error) {
    throw new AttendanceAdminError(error.message, 500);
  }
  if (!record) {
    throw new AttendanceAdminError("勤怠記録が見つかりません", 404);
  }
  if (!context.isSuperAdmin && record.company_id !== context.companyId) {
    throw new AttendanceAdminError("この勤怠記録を修正する権限がありません", 403);
  }

  return record;
}

export async function assertEmployeeAccess(
  supabase: SupabaseClient,
  context: CompanyContext,
  employeeId: string
): Promise<{ id: string; company_id: string; store_id: string; name: string }> {
  const { data: employee, error } = await supabase
    .from("employees")
    .select("id, company_id, store_id, name")
    .eq("id", employeeId)
    .maybeSingle();

  if (error) {
    throw new AttendanceAdminError(error.message, 500);
  }
  if (!employee) {
    throw new AttendanceAdminError("従業員が見つかりません", 404);
  }
  if (!context.isSuperAdmin && employee.company_id !== context.companyId) {
    throw new AttendanceAdminError("この従業員の勤怠を登録する権限がありません", 403);
  }

  return employee;
}
