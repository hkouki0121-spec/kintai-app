import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildAttendanceLineMessage,
  type AttendanceNotifyType,
} from "@/lib/line/build-attendance-message";
import { sendLinePushMessage } from "@/lib/line/send-message";

export type NotifyStoreAttendanceParams = {
  type: AttendanceNotifyType;
  employeeId: string;
  storeId: string;
  employeeName: string;
  timestamp: string;
};

type StoreLineSettings = {
  name: string;
  line_group_id: string | null;
  line_notify_enabled: boolean;
};

function resolveLineGroupId(store: StoreLineSettings): string | null {
  const groupId = store.line_group_id?.trim();
  return groupId || null;
}

async function verifyAttendanceEvent(
  supabase: SupabaseClient,
  params: NotifyStoreAttendanceParams
): Promise<boolean> {
  const eventTime = new Date(params.timestamp).getTime();
  const windowMs = 5 * 60 * 1000;

  if (params.type === "clock_in") {
    const { data, error } = await supabase
      .from("attendance_records")
      .select("clock_in")
      .eq("employee_id", params.employeeId)
      .eq("store_id", params.storeId)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return false;
    return Math.abs(new Date(data.clock_in).getTime() - eventTime) <= windowMs;
  }

  const { data, error } = await supabase
    .from("attendance_records")
    .select("clock_out")
    .eq("employee_id", params.employeeId)
    .eq("store_id", params.storeId)
    .not("clock_out", "is", null)
    .order("clock_out", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.clock_out) return false;
  return Math.abs(new Date(data.clock_out).getTime() - eventTime) <= windowMs;
}

export async function notifyStoreAttendanceLine(
  supabase: SupabaseClient,
  params: NotifyStoreAttendanceParams
): Promise<{ sent: boolean; reason?: string }> {
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("name, line_group_id, line_notify_enabled")
    .eq("id", params.storeId)
    .maybeSingle();

  if (storeError || !store) {
    return { sent: false, reason: "store_not_found" };
  }

  if (!store.line_notify_enabled) {
    return { sent: false, reason: "notify_disabled" };
  }

  const recipient = resolveLineGroupId(store as StoreLineSettings);
  if (!recipient) {
    return { sent: false, reason: "no_group" };
  }

  const verified = await verifyAttendanceEvent(supabase, params);
  if (!verified) {
    return { sent: false, reason: "attendance_not_verified" };
  }

  const message = buildAttendanceLineMessage({
    type: params.type,
    employeeName: params.employeeName,
    storeName: store.name,
    timestamp: params.timestamp,
  });

  await sendLinePushMessage(recipient, message);
  return { sent: true };
}
