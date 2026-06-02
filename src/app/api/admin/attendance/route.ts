import { NextResponse } from "next/server";
import { createManualAttendanceWithCorrection } from "@/lib/attendance/correct";
import {
  assertEmployeeAccess,
  AttendanceAdminError,
  requireAttendanceAdmin,
} from "@/lib/attendance/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type PostBody = {
  employeeId: string;
  clockIn: string;
  clockOut?: string | null;
  reason: string;
};

/** 出勤忘れなど: 管理者による勤怠の手動登録 */
export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const context = await requireAttendanceAdmin(supabase);
    let body: PostBody;
    try {
      body = (await request.json()) as PostBody;
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    if (!body.employeeId?.trim()) {
      return NextResponse.json({ error: "employee_required" }, { status: 400 });
    }
    if (!body.clockIn?.trim()) {
      return NextResponse.json({ error: "clock_in_required" }, { status: 400 });
    }
    if (!body.reason?.trim()) {
      return NextResponse.json({ error: "reason_required" }, { status: 400 });
    }

    await assertEmployeeAccess(supabase, context, body.employeeId.trim());

    const service = createServiceClient();
    const { recordId, correction } = await createManualAttendanceWithCorrection(service, {
      employeeId: body.employeeId.trim(),
      clockIn: body.clockIn,
      clockOut: body.clockOut ?? null,
      reason: body.reason.trim(),
      correctedBy: context.userId,
    });

    return NextResponse.json({ ok: true, recordId, correction });
  } catch (error) {
    if (error instanceof AttendanceAdminError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "create_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
