import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { AttendanceCorrection } from "@/types/database";
import { AttendanceAdminError } from "@/lib/attendance/admin-auth";
import { syncEmployeePayrollAfterAttendance } from "@/lib/payroll/recalculate-employee";

export type ApplyCorrectionParams = {
  recordId: string;
  clockIn?: string | null;
  clockOut?: string | null;
  reason: string;
  correctedBy: string;
};

function throwDbError(
  step: string,
  error: PostgrestError,
  summary: string,
  debug?: Record<string, unknown>
): never {
  throw new AttendanceAdminError(summary, 400, {
    code: error.code ?? null,
    details: error.details ?? null,
    denialStep: step,
    debug,
  });
}

export async function applyAttendanceCorrection(
  supabase: SupabaseClient,
  params: ApplyCorrectionParams
): Promise<AttendanceCorrection> {
  const { data: record, error: fetchError } = await supabase
    .from("attendance_records")
    .select("id, employee_id, company_id, store_id, clock_in, clock_out")
    .eq("id", params.recordId)
    .maybeSingle();

  if (fetchError) {
    throwDbError("attendance_record_fetch", fetchError, fetchError.message);
  }
  if (!record) throw new Error("勤怠記録が見つかりません");

  const nextClockIn = params.clockIn ?? record.clock_in;
  const nextClockOut =
    params.clockOut === undefined ? record.clock_out : params.clockOut;

  if (nextClockOut && new Date(nextClockOut) <= new Date(nextClockIn)) {
    throw new Error("退勤時刻は出勤時刻より後にしてください");
  }

  const hasClockInChange = nextClockIn !== record.clock_in;
  const hasClockOutChange = nextClockOut !== record.clock_out;

  if (!hasClockInChange && !hasClockOutChange) {
    throw new Error("修正内容がありません");
  }

  const { error: updateError } = await supabase
    .from("attendance_records")
    .update({
      clock_in: nextClockIn,
      clock_out: nextClockOut,
    })
    .eq("id", params.recordId);

  if (updateError) {
    throwDbError("attendance_record_update", updateError, updateError.message, {
      recordId: params.recordId,
    });
  }

  const { data: correction, error: insertError } = await supabase
    .from("attendance_corrections")
    .insert({
      attendance_record_id: params.recordId,
      employee_id: record.employee_id,
      company_id: record.company_id,
      store_id: record.store_id,
      before_clock_in: record.clock_in,
      before_clock_out: record.clock_out,
      after_clock_in: nextClockIn,
      after_clock_out: nextClockOut,
      reason: params.reason,
      corrected_by: params.correctedBy,
    })
    .select("*")
    .single();

  if (insertError) {
    throwDbError("attendance_correction_insert", insertError, insertError.message, {
      recordId: params.recordId,
      employeeId: record.employee_id,
      companyId: record.company_id,
    });
  }

  await syncEmployeePayrollAfterAttendance(
    supabase,
    record.employee_id,
    record.clock_in,
    record.clock_out,
    nextClockIn,
    nextClockOut
  );

  return correction as AttendanceCorrection;
}

export type CreateManualAttendanceParams = {
  employeeId: string;
  clockIn: string;
  clockOut?: string | null;
  reason: string;
  correctedBy: string;
};

export async function createManualAttendanceWithCorrection(
  supabase: SupabaseClient,
  params: CreateManualAttendanceParams
): Promise<{ recordId: string; correction: AttendanceCorrection }> {
  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id, company_id, store_id")
    .eq("id", params.employeeId)
    .maybeSingle();

  if (employeeError) {
    throwDbError("employee_fetch_service", employeeError, employeeError.message, {
      employeeId: params.employeeId,
    });
  }
  if (!employee) throw new Error("従業員が見つかりません");

  const clockOut = params.clockOut ?? null;
  if (clockOut && new Date(clockOut) <= new Date(params.clockIn)) {
    throw new Error("退勤時刻は出勤時刻より後にしてください");
  }

  const { data: record, error: insertRecordError } = await supabase
    .from("attendance_records")
    .insert({
      employee_id: employee.id,
      company_id: employee.company_id,
      store_id: employee.store_id,
      clock_in: params.clockIn,
      clock_out: clockOut,
      is_qr_clock: false,
    })
    .select("id, employee_id, company_id, store_id, clock_in, clock_out")
    .single();

  if (insertRecordError) {
    throwDbError("attendance_record_insert", insertRecordError, insertRecordError.message, {
      employeeId: employee.id,
      employeeCompanyId: employee.company_id,
      employeeStoreId: employee.store_id,
    });
  }

  const { data: correction, error: insertCorrectionError } = await supabase
    .from("attendance_corrections")
    .insert({
      attendance_record_id: record.id,
      employee_id: record.employee_id,
      company_id: record.company_id,
      store_id: record.store_id,
      before_clock_in: null,
      before_clock_out: null,
      after_clock_in: record.clock_in,
      after_clock_out: record.clock_out,
      reason: params.reason,
      corrected_by: params.correctedBy,
    })
    .select("*")
    .single();

  if (insertCorrectionError) {
    throwDbError("attendance_correction_insert", insertCorrectionError, insertCorrectionError.message, {
      attendanceRecordId: record.id,
      employeeId: record.employee_id,
      companyId: record.company_id,
    });
  }

  await syncEmployeePayrollAfterAttendance(
    supabase,
    record.employee_id,
    record.clock_in,
    record.clock_out
  );

  return { recordId: record.id, correction: correction as AttendanceCorrection };
}

export async function enrichCorrectionEmails(
  supabase: SupabaseClient,
  corrections: AttendanceCorrection[]
): Promise<AttendanceCorrection[]> {
  const userIds = [...new Set(corrections.map((c) => c.corrected_by).filter(Boolean))] as string[];
  if (userIds.length === 0) return corrections;

  const emailByUserId = new Map<string, string | null>();
  await Promise.all(
    userIds.map(async (userId) => {
      const { data, error } = await supabase.auth.admin.getUserById(userId);
      if (!error && data.user) {
        emailByUserId.set(userId, data.user.email ?? null);
      }
    })
  );

  return corrections.map((item) => ({
    ...item,
    corrected_by_email: item.corrected_by
      ? (emailByUserId.get(item.corrected_by) ?? null)
      : null,
  }));
}
