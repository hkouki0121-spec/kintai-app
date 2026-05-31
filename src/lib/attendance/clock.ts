import type { SupabaseClient } from "@supabase/supabase-js";

export type StampAction = "clock_in" | "clock_out";

export type ClockInParams = {
  employeeId: string;
  storeId: string;
  clockIn: string;
};

export type ClockOutParams = {
  employeeId: string;
  clockOut: string;
};

function parseSupabaseError(error: { message?: string; code?: string }): string {
  return error.message ?? "データベースエラーが発生しました";
}

/** 出勤: attendance_records に新規 INSERT のみ */
export async function clockIn(
  supabase: SupabaseClient,
  { employeeId, storeId, clockIn: clockInAt }: ClockInParams
): Promise<void> {
  const { data: open, error: openError } = await supabase
    .from("attendance_records")
    .select("id")
    .eq("employee_id", employeeId)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openError) {
    throw new Error(parseSupabaseError(openError));
  }
  if (open) {
    throw new Error("ALREADY_CLOCKED_IN");
  }

  const { error: insertError } = await supabase.from("attendance_records").insert({
    employee_id: employeeId,
    store_id: storeId,
    clock_in: clockInAt,
  });

  if (insertError) {
    throw new Error(parseSupabaseError(insertError));
  }
}

/** 退勤: INSERT は行わず、clock_out が NULL の最新レコードのみ UPDATE */
export async function clockOut(
  supabase: SupabaseClient,
  { employeeId, clockOut: clockOutAt }: ClockOutParams
): Promise<void> {
  const { data: record, error: fetchError } = await supabase
    .from("attendance_records")
    .select("id, clock_in")
    .eq("employee_id", employeeId)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    throw new Error(parseSupabaseError(fetchError));
  }
  if (!record) {
    throw new Error("NO_OPEN_RECORD");
  }

  const { data: updated, error: updateError } = await supabase
    .from("attendance_records")
    .update({ clock_out: clockOutAt })
    .eq("id", record.id)
    .eq("employee_id", employeeId)
    .is("clock_out", null)
    .select("id, clock_out")
    .maybeSingle();

  if (updateError) {
    throw new Error(parseSupabaseError(updateError));
  }
  if (!updated) {
    throw new Error("CLOCK_OUT_UPDATE_FAILED");
  }
}

/** 打刻種別に応じて clockIn / clockOut のみ呼び出す（退勤で insert しない） */
export async function performStamp(
  supabase: SupabaseClient,
  action: StampAction,
  params: { employeeId: string; storeId: string; timestamp: string }
): Promise<void> {
  if (action === "clock_in") {
    await clockIn(supabase, {
      employeeId: params.employeeId,
      storeId: params.storeId,
      clockIn: params.timestamp,
    });
    return;
  }

  await clockOut(supabase, {
    employeeId: params.employeeId,
    clockOut: params.timestamp,
  });
}
