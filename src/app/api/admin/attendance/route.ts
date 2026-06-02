import { NextResponse } from "next/server";
import { createManualAttendanceWithCorrection } from "@/lib/attendance/correct";
import {
  assertEmployeeAccess,
  AttendanceAdminError,
  requireAttendanceAdmin,
} from "@/lib/attendance/admin-auth";
import {
  buildAttendanceErrorPayload,
  logAttendanceManualCreate,
} from "@/lib/attendance/api-errors";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type PostBody = {
  employeeId: string;
  clockIn: string;
  clockOut?: string | null;
  reason: string;
};

function errorResponse(status: number, payload: ReturnType<typeof buildAttendanceErrorPayload>) {
  logAttendanceManualCreate("error", { status, ...payload });
  return NextResponse.json(payload, { status });
}

/** 出勤忘れなど: 管理者による勤怠の手動登録 */
export async function POST(request: Request) {
  logAttendanceManualCreate("start", {});

  const supabase = await createClient();

  try {
    const context = await requireAttendanceAdmin(supabase);
    logAttendanceManualCreate("admin_context", {
      userId: context.userId,
      role: context.role,
      companyId: context.companyId,
      isSuperAdmin: context.isSuperAdmin,
    });

    let body: PostBody;
    try {
      body = (await request.json()) as PostBody;
    } catch {
      return errorResponse(
        400,
        buildAttendanceErrorPayload("invalid_json", { denialStep: "parse_body" })
      );
    }

    logAttendanceManualCreate("request_body", {
      employeeId: body.employeeId,
      hasClockIn: Boolean(body.clockIn),
      hasClockOut: Boolean(body.clockOut),
      hasReason: Boolean(body.reason?.trim()),
    });

    if (!body.employeeId?.trim()) {
      return errorResponse(
        400,
        buildAttendanceErrorPayload("employee_required", { denialStep: "validate_body" })
      );
    }
    if (!body.clockIn?.trim()) {
      return errorResponse(
        400,
        buildAttendanceErrorPayload("clock_in_required", { denialStep: "validate_body" })
      );
    }
    if (!body.reason?.trim()) {
      return errorResponse(
        400,
        buildAttendanceErrorPayload("reason_required", { denialStep: "validate_body" })
      );
    }

    const employee = await assertEmployeeAccess(supabase, context, body.employeeId.trim());
    logAttendanceManualCreate("employee_access_ok", {
      employeeId: employee.id,
      employeeName: employee.name,
      employeeCompanyId: employee.company_id,
      employeeStoreId: employee.store_id,
      adminCompanyId: context.companyId,
      companyIdMatchesAdmin: employee.company_id === context.companyId,
    });

    let service;
    try {
      service = createServiceClient();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Supabase 設定エラー";
      return errorResponse(
        500,
        buildAttendanceErrorPayload(message, {
          code: "CONFIG",
          denialStep: "service_client",
        })
      );
    }

    logAttendanceManualCreate("insert_attendance_records", {
      employeeId: employee.id,
      companyId: employee.company_id,
      storeId: employee.store_id,
    });

    const { recordId, correction } = await createManualAttendanceWithCorrection(service, {
      employeeId: body.employeeId.trim(),
      clockIn: body.clockIn,
      clockOut: body.clockOut ?? null,
      reason: body.reason.trim(),
      correctedBy: context.userId,
    });

    logAttendanceManualCreate("success", {
      recordId,
      correctionId: correction.id,
      employeeId: employee.id,
    });

    return NextResponse.json({ ok: true, recordId, correction });
  } catch (error) {
    if (error instanceof AttendanceAdminError) {
      return errorResponse(error.status, error.toPayload());
    }
    const message = error instanceof Error ? error.message : "create_failed";
    return errorResponse(
      400,
      buildAttendanceErrorPayload(message, {
        denialStep: "unexpected",
        message,
      })
    );
  }
}
