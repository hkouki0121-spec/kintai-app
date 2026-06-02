import { NextResponse } from "next/server";
import { enrichCorrectionEmails } from "@/lib/attendance/correct";
import {
  assertAttendanceRecordAccess,
  AttendanceAdminError,
  requireAttendanceAdmin,
} from "@/lib/attendance/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type RouteParams = { params: Promise<{ id: string }> };

/** 勤怠修正履歴の取得（管理者のみ） */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  try {
    const context = await requireAttendanceAdmin(supabase);
    await assertAttendanceRecordAccess(supabase, context, id);

    const service = createServiceClient();
    const { data, error } = await service
      .from("attendance_corrections")
      .select("*")
      .eq("attendance_record_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const corrections = await enrichCorrectionEmails(service, data ?? []);
    return NextResponse.json({ corrections });
  } catch (error) {
    if (error instanceof AttendanceAdminError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "fetch_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
