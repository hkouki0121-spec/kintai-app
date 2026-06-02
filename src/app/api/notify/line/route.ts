import { NextResponse } from "next/server";
import type { AttendanceNotifyType } from "@/lib/line/build-attendance-message";
import { notifyStoreAttendanceLine } from "@/lib/line/notify-store-attendance";
import { createServiceClient } from "@/lib/supabase/service";

type NotifyLineRequest = {
  type: AttendanceNotifyType;
  employeeId: string;
  storeId: string;
  employeeName: string;
  timestamp: string;
  isQrClock?: boolean;
};

function isValidRequest(body: unknown): body is NotifyLineRequest {
  if (!body || typeof body !== "object") return false;
  const value = body as Record<string, unknown>;
  return (
    (value.type === "clock_in" || value.type === "clock_out") &&
    typeof value.employeeId === "string" &&
    typeof value.storeId === "string" &&
    typeof value.employeeName === "string" &&
    typeof value.timestamp === "string"
  );
}

/** 出勤・退勤時の店舗別 LINE 通知（失敗しても打刻自体は成功扱い） */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true, sent: false, reason: "invalid_json" });
  }

  if (!isValidRequest(body)) {
    return NextResponse.json({ ok: true, sent: false, reason: "invalid_request" });
  }

  try {
    const supabase = createServiceClient();
    const result = await notifyStoreAttendanceLine(supabase, body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[notify/line]", error);
    return NextResponse.json({
      ok: true,
      sent: false,
      reason: error instanceof Error ? error.message : "line_send_failed",
    });
  }
}
