import { NextResponse } from "next/server";
import { clockIn, clockOut } from "@/lib/attendance/clock";
import { notifyStoreAttendanceLine } from "@/lib/line/notify-store-attendance";
import { createServiceClient } from "@/lib/supabase/service";
import { extractQrTokenFromScan, hashQrToken } from "@/lib/stores/qr-token";

type QrClockRequest = {
  token: string;
  employeeId: string;
  action: "clock_in" | "clock_out";
};

function isValidRequest(body: unknown): body is QrClockRequest {
  if (!body || typeof body !== "object") return false;
  const value = body as Record<string, unknown>;
  return (
    typeof value.token === "string" &&
    value.token.trim().length > 0 &&
    typeof value.employeeId === "string" &&
    (value.action === "clock_in" || value.action === "clock_out")
  );
}

async function findStoreByToken(supabase: ReturnType<typeof createServiceClient>, token: string) {
  const parsed = extractQrTokenFromScan(token) ?? token;
  const tokenHash = hashQrToken(parsed);
  const { data, error } = await supabase
    .from("stores")
    .select("id, name, is_active, company_id")
    .eq("qr_token_hash", tokenHash)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || !data.is_active) return null;
  return data;
}

/** 顔認証失敗時のQR緊急打刻 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isValidRequest(body)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const store = await findStoreByToken(supabase, body.token);
    if (!store) {
      return NextResponse.json({ error: "invalid_token" }, { status: 404 });
    }

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id, name, store_id, company_id, is_active")
      .eq("id", body.employeeId)
      .maybeSingle();

    if (employeeError) throw new Error(employeeError.message);
    if (!employee || !employee.is_active) {
      return NextResponse.json({ error: "employee_not_found" }, { status: 404 });
    }
    if (employee.store_id !== store.id) {
      return NextResponse.json({ error: "employee_store_mismatch" }, { status: 403 });
    }

    const now = new Date().toISOString();

    if (body.action === "clock_in") {
      await clockIn(supabase, {
        employeeId: employee.id,
        storeId: store.id,
        companyId: store.company_id,
        clockIn: now,
        isQrClock: true,
      });
    } else {
      await clockOut(supabase, {
        employeeId: employee.id,
        clockOut: now,
        isQrClock: true,
      });
    }

    await notifyStoreAttendanceLine(supabase, {
      type: body.action,
      employeeId: employee.id,
      storeId: store.id,
      employeeName: employee.name,
      timestamp: now,
      isQrClock: true,
    });

    return NextResponse.json({
      ok: true,
      employeeName: employee.name,
      storeName: store.name,
      timestamp: now,
      action: body.action,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ALREADY_CLOCKED_IN") {
        return NextResponse.json({ error: "already_clocked_in" }, { status: 409 });
      }
      if (error.message === "NO_OPEN_RECORD") {
        return NextResponse.json({ error: "no_open_record" }, { status: 409 });
      }
    }

    console.error("[kiosk/qr-clock]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "clock_failed" },
      { status: 500 }
    );
  }
}
