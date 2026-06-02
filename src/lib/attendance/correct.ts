import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttendanceCorrection } from "@/types/database";

export type ApplyCorrectionParams = {
  recordId: string;
  clockIn?: string | null;
  clockOut?: string | null;
  reason: string;
  correctorUserId: string | null;
  correctorName: string;
};

export async function applyAttendanceCorrection(
  supabase: SupabaseClient,
  params: ApplyCorrectionParams
): Promise<AttendanceCorrection> {
  const { data: record, error: fetchError } = await supabase
    .from("attendance_records")
    .select("id, clock_in, clock_out")
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
      corrector_user_id: params.correctorUserId,
      corrector_name: params.correctorName,
      reason: params.reason,
      clock_in_before: record.clock_in,
      clock_in_after: hasClockInChange ? nextClockIn : null,
      clock_out_before: record.clock_out,
      clock_out_after: hasClockOutChange ? nextClockOut : null,
    })
    .select("*")
    .single();

  if (insertError) throw new Error(insertError.message);
  return correction as AttendanceCorrection;
}
