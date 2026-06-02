import { NextResponse } from "next/server";
import { applyAttendanceCorrection } from "@/lib/attendance/correct";
import {
  assertAttendanceRecordAccess,
  AttendanceAdminError,
  requireAttendanceAdmin,
} from "@/lib/attendance/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type PatchBody = {
  clockIn?: string | null;
  clockOut?: string | null;
  reason: string;
};

type RouteParams = { params: Promise<{ id: string }> };

/** 勤怠記録の修正（管理者のみ） */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  try {
    const context = await requireAttendanceAdmin(supabase);
    await assertAttendanceRecordAccess(supabase, context, id);

    let body: PatchBody;
    try {
      body = (await request.json()) as PatchBody;
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    if (!body.reason?.trim()) {
      return NextResponse.json({ error: "reason_required" }, { status: 400 });
    }

    const service = createServiceClient();
    const correction = await applyAttendanceCorrection(service, {
      recordId: id,
      clockIn: body.clockIn,
      clockOut: body.clockOut,
      reason: body.reason.trim(),
      correctedBy: context.userId,
    });

    return NextResponse.json({ ok: true, correction });
  } catch (error) {
    if (error instanceof AttendanceAdminError) {
      return NextResponse.json(error.toPayload(), { status: error.status });
    }
    const message = error instanceof Error ? error.message : "correction_failed";
    return NextResponse.json({ error: message, message, code: null, details: null }, { status: 400 });
  }
}
