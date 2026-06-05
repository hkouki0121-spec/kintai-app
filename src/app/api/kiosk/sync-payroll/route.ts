import { NextResponse } from "next/server";
import { syncEmployeePayrollAfterAttendance } from "@/lib/payroll/recalculate-employee";
import { createServiceClient } from "@/lib/supabase/service";

/** 打刻後に給与を勤怠から自動反映（キオスク・顔認証打刻用） */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const employeeId = (body as { employeeId?: string }).employeeId?.trim();
  if (!employeeId) {
    return NextResponse.json({ error: "employeeId が必要です" }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const { data: record } = await supabase
      .from("attendance_records")
      .select("clock_in, clock_out")
      .eq("employee_id", employeeId)
      .order("clock_in", { ascending: false })
      .limit(1)
      .maybeSingle();

    await syncEmployeePayrollAfterAttendance(
      supabase,
      employeeId,
      record?.clock_in,
      record?.clock_out
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[kiosk/sync-payroll]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "sync_failed" },
      { status: 500 }
    );
  }
}
