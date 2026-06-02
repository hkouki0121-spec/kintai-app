import { NextResponse } from "next/server";
import { getCompanyContext } from "@/lib/auth/company-context";
import {
  formatStoreDeleteBlockMessage,
  resolveStoreDeleteBlockReasons,
  storeHasLineSettings,
} from "@/lib/stores/delete-store";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type RouteParams = { params: Promise<{ id: string }> };

function errorResponse(
  status: number,
  summary: string,
  source?: { message?: string; code?: string; details?: string } | null,
  extra?: Record<string, unknown>
) {
  const body = {
    error: summary,
    message: source?.message ?? summary,
    code: source?.code ?? null,
    details: source?.details ?? null,
    ...extra,
  };
  console.error("[stores/delete]", status, body);
  return NextResponse.json(body, { status });
}

/** 店舗削除（company_admin のみ・関連データがある場合は不可） */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const context = await getCompanyContext(supabase);

  console.log("[stores/delete] start", { storeId: id, userId: context?.userId, role: context?.role });

  if (!context) {
    return errorResponse(401, "ログインセッションが無効です。再度ログインしてください。");
  }

  if (context.isSuperAdmin || context.role !== "company_admin") {
    return errorResponse(403, "店舗の削除権限がありません。");
  }

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, company_id, line_group_id, line_user_id, line_notify_enabled")
    .eq("id", id)
    .maybeSingle();

  if (storeError) {
    return errorResponse(500, "店舗情報の取得に失敗しました", storeError);
  }

  if (!store) {
    return errorResponse(
      404,
      "店舗が見つからないか、削除権限がありません。"
    );
  }

  let service;
  try {
    service = createServiceClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase 設定エラー";
    return errorResponse(500, message, { message, code: "CONFIG" });
  }

  const [{ count: employeeCount }, { count: attendanceCount }] =
    await Promise.all([
      service
        .from("employees")
        .select("*", { count: "exact", head: true })
        .eq("store_id", id),
      service
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .eq("store_id", id),
    ]);

  const counts = {
    employees: employeeCount ?? 0,
    attendance: attendanceCount ?? 0,
  };

  const blockReasons = resolveStoreDeleteBlockReasons({
    employeeCount: counts.employees,
    attendanceCount: counts.attendance,
    hasLineSettings: storeHasLineSettings(store),
  });

  if (blockReasons.length > 0) {
    return errorResponse(
      400,
      formatStoreDeleteBlockMessage(blockReasons, counts),
      { message: "related_data_exists", code: "STORE_DELETE_BLOCKED" },
      { reasons: blockReasons, counts }
    );
  }

  const { error: deleteError } = await service.from("stores").delete().eq("id", id);

  if (deleteError) {
    return errorResponse(500, "店舗の削除に失敗しました", deleteError);
  }

  console.log("[stores/delete] success", { storeId: id, storeCompanyId: store.company_id });

  return NextResponse.json({ ok: true, deletedId: id });
}
