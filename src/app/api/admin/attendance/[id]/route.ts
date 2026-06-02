import { NextResponse } from "next/server";
import { applyAttendanceCorrection } from "@/lib/attendance/correct";
import { createClient } from "@/lib/supabase/server";

function resolveCorrectorName(user: { email?: string; user_metadata?: Record<string, unknown> }): string {
  const meta = user.user_metadata;
  if (meta && typeof meta.full_name === "string" && meta.full_name.trim()) {
    return meta.full_name.trim();
  }
  if (meta && typeof meta.name === "string" && meta.name.trim()) {
    return meta.name.trim();
  }
  return user.email ?? "管理者";
}

type PatchBody = {
  clockIn?: string | null;
  clockOut?: string | null;
  reason: string;
};

type RouteParams = { params: Promise<{ id: string }> };

/** 勤怠記録の修正 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.reason?.trim()) {
    return NextResponse.json({ error: "reason_required" }, { status: 400 });
  }

  try {
    const correction = await applyAttendanceCorrection(supabase, {
      recordId: id,
      clockIn: body.clockIn,
      clockOut: body.clockOut,
      reason: body.reason.trim(),
      correctorUserId: user.id,
      correctorName: resolveCorrectorName(user),
    });

    return NextResponse.json({ ok: true, correction });
  } catch (error) {
    const message = error instanceof Error ? error.message : "correction_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
