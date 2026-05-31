import type { SupabaseClient } from "@supabase/supabase-js";

export type ClockInParams = {
  employeeId: string;
  storeId: string;
  clockIn: string;
};

export type ClockOutParams = {
  employeeId: string;
  clockOut: string;
};

/** 出勤: attendance_records に新規 INSERT */
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

  if (openError) throw openError;
  if (open) {
    throw new Error("ALREADY_CLOCKED_IN");
  }

  const { error } = await supabase.from("attendance_records").insert({
    employee_id: employeeId,
    store_id: storeId,
    clock_in: clockInAt,
  });

  if (error) throw error;
}

/** 退勤: clock_out が NULL の最新レコードを UPDATE（INSERT しない） */
export async function clockOut(
  supabase: SupabaseClient,
  { employeeId, clockOut: clockOutAt }: ClockOutParams
): Promise<void> {
  const { data: record, error: fetchError } = await supabase
    .from("attendance_records")
    .select("id")
    .eq("employee_id", employeeId)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!record) {
    throw new Error("NO_OPEN_RECORD");
  }

  const { data: updated, error: updateError } = await supabase
    .from("attendance_records")
    .update({ clock_out: clockOutAt })
    .eq("id", record.id)
    .is("clock_out", null)
    .select("id")
    .maybeSingle();

  if (updateError) throw updateError;
  if (!updated) {
    throw new Error("CLOCK_OUT_UPDATE_FAILED");
  }
}
