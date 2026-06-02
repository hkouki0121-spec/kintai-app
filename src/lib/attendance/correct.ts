import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttendanceCorrection } from "@/types/database";

export type ApplyCorrectionParams = {
  recordId: string;
  clockIn?: string | null;
  clockOut?: string | null;
  reason: string;
  correctedBy: string;
};

export async function applyAttendanceCorrection(
  supabase: SupabaseClient,
  params: ApplyCorrectionParams
): Promise<AttendanceCorrection> {
  const { data: record, error: fetchError } = await supabase
    .from("attendance_records")
    .select("id, employee_id, company_id, store_id, clock_in, clock_out")
    .eq("id", params.recordId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
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

  if (updateError) throw new Error(updateError.message);

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

  if (insertError) throw new Error(insertError.message);
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

  if (employeeError) throw new Error(employeeError.message);
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

  if (insertRecordError) throw new Error(insertRecordError.message);

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

  if (insertCorrectionError) throw new Error(insertCorrectionError.message);

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
