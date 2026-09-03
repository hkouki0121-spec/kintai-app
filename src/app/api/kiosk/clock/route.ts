import { NextResponse } from "next/server";
import { clockIn, clockOut } from "@/lib/attendance/clock";
import { createServiceClient } from "@/lib/supabase/service";

type ClockBody = {
  action?: "clock_in" | "clock_out";
  employeeId?: string;
  storeId?: string;
};

/** 顔認証打刻。anon の attendance RLS を使わずサーバー側で店舗一致を検証する */
export async function POST(request: Request) {
  let body: ClockBody;
  try {
    body = (await request.json()) as ClockBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const action = body.action;
  const employeeId = body.employeeId?.trim();
  const storeId = body.storeId?.trim();
  if (!employeeId || (action !== "clock_in" && action !== "clock_out")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (action === "clock_in" && !storeId) {
    return NextResponse.json({ error: "storeId が必要です" }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const { data: employee } = await supabase
      .from("employees")
      .select("id, name, store_id, company_id, is_active")
      .eq("id", employeeId)
      .maybeSingle();

    if (!employee || !employee.is_active) {
      return NextResponse.json({ error: "employee_not_found" }, { status: 404 });
    }
    if (storeId && employee.store_id !== storeId) {
      return NextResponse.json({ error: "employee_store_mismatch" }, { status: 403 });
    }

    const now = new Date().toISOString();
    if (action === "clock_in") {
      await clockIn(supabase, {
        employeeId: employee.id,
        storeId: employee.store_id,
        companyId: employee.company_id,
        clockIn: now,
      });
    } else {
      await clockOut(supabase, { employeeId: employee.id, clockOut: now });
    }

    return NextResponse.json({ ok: true, employeeName: employee.name });
  } catch (error) {
    const message = error instanceof Error ? error.message : "clock_failed";
    if (message === "ALREADY_CLOCKED_IN" || message === "NO_OPEN_RECORD") {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
