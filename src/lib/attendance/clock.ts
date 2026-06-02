import type { SupabaseClient } from "@supabase/supabase-js";

export type StampAction = "clock_in" | "clock_out";

export type ClockInParams = {
  employeeId: string;
  storeId: string;
  companyId: string;
  clockIn: string;
  isQrClock?: boolean;
};

export type ClockOutParams = {
  employeeId: string;
  clockOut: string;
  isQrClock?: boolean;
};

function parseSupabaseError(error: { message?: string; code?: string }): string {
  return error.message ?? "データベースエラーが発生しました";
}

/** 未退勤レコードが1件でもあればその id を返す（出勤前チェック用） */
async function findAnyOpenRecordId(
  supabase: SupabaseClient,
  employeeId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("attendance_records")
    .select("id")
    .eq("employee_id", employeeId)
    .is("clock_out", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(parseSupabaseError(error));
  }
  return data?.id ?? null;
}

/** clock_in DESC で最新の未退勤レコード id を返す（退勤用） */
async function findLatestOpenRecordId(
  supabase: SupabaseClient,
  employeeId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("attendance_records")
    .select("id")
    .eq("employee_id", employeeId)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(parseSupabaseError(error));
  }
  return data?.id ?? null;
}

/** 退勤後に残った重複未退勤レコードを同時刻で締める */
async function closeRemainingOpenRecords(
  supabase: SupabaseClient,
  employeeId: string,
  clockOutAt: string
): Promise<void> {
  const { error } = await supabase
    .from("attendance_records")
    .update({ clock_out: clockOutAt })
    .eq("employee_id", employeeId)
    .is("clock_out", null);

  if (error) {
    throw new Error(parseSupabaseError(error));
  }
}

/** 出勤: 未退勤がなければ INSERT のみ。既にあれば ALREADY_CLOCKED_IN */
export async function clockIn(
  supabase: SupabaseClient,
  { employeeId, storeId, companyId, clockIn: clockInAt, isQrClock = false }: ClockInParams
): Promise<void> {
  const openId = await findAnyOpenRecordId(supabase, employeeId);
  if (openId) {
    throw new Error("ALREADY_CLOCKED_IN");
  }

  const { error: insertError } = await supabase.from("attendance_records").insert({
    employee_id: employeeId,
    store_id: storeId,
    company_id: companyId,
    clock_in: clockInAt,
    is_qr_clock: isQrClock,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      throw new Error("ALREADY_CLOCKED_IN");
    }
    throw new Error(parseSupabaseError(insertError));
  }
}

/**
 * 退勤: INSERT / UPSERT は行わない。
 * 最新の未退勤1件を UPDATE し、重複未退勤が残っていれば同時刻で締める。
 */
export async function clockOut(
  supabase: SupabaseClient,
  { employeeId, clockOut: clockOutAt, isQrClock = false }: ClockOutParams
): Promise<void> {
  const recordId = await findLatestOpenRecordId(supabase, employeeId);
  if (!recordId) {
    throw new Error("NO_OPEN_RECORD");
  }

  const updatePayload: { clock_out: string; is_qr_clock?: boolean } = {
    clock_out: clockOutAt,
  };
  if (isQrClock) {
    updatePayload.is_qr_clock = true;
  }

  const { error: updateError } = await supabase
    .from("attendance_records")
    .update(updatePayload)
    .eq("id", recordId)
    .eq("employee_id", employeeId)
    .is("clock_out", null);

  if (updateError) {
    throw new Error(parseSupabaseError(updateError));
  }

  await closeRemainingOpenRecords(supabase, employeeId, clockOutAt);
}
