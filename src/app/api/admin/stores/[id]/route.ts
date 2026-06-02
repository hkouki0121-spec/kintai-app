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
  const { id: storeId } = await params;

  console.log("[stores/delete] start");
  console.log("[stores/delete] storeId", storeId);

  const supabase = await createClient();
  const context = await getCompanyContext(supabase);

  console.log("[stores/delete] context", {
    userId: context?.userId ?? null,
    role: context?.role ?? null,
    companyId: context?.companyId ?? null,
  });

  if (!context) {
    return errorResponse(401, "ログインセッションが無効です。再度ログインしてください。");
  }

  if (context.isSuperAdmin || context.role !== "company_admin") {
    return errorResponse(403, "店舗の削除権限がありません。");
  }

  let service;
  try {
    service = createServiceClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase 設定エラー";
    return errorResponse(500, message, { message, code: "CONFIG" });
  }

  const { data: accessibleStores, error: accessibleError } = await supabase
    .from("stores")
    .select("id");

  if (accessibleError) {
    return errorResponse(500, "店舗一覧の取得に失敗しました", accessibleError);
  }

  const canAccessStore = (accessibleStores ?? []).some((row) => row.id === storeId);
  console.log("[stores/delete] accessibleStoreIds", (accessibleStores ?? []).map((row) => row.id));
  console.log("[stores/delete] canAccessStore", canAccessStore);

  if (!canAccessStore) {
    return errorResponse(
      403,
      "この店舗を削除する権限がありません。"
    );
  }

  const { data: store, error: storeError } = await service
    .from("stores")
    .select("id, company_id, name, line_group_id, line_user_id, line_notify_enabled")
    .eq("id", storeId)
    .maybeSingle();

  console.log("[stores/delete] storeBeforeDelete", { store, storeError });

  if (storeError) {
    return errorResponse(500, "店舗情報の取得に失敗しました", storeError);
  }

  if (!store) {
    return errorResponse(404, "店舗が見つかりません。");
  }

  const [{ count: employeeCount }, { count: attendanceCount }] =
    await Promise.all([
      service
        .from("employees")
        .select("*", { count: "exact", head: true })
        .eq("store_id", storeId),
      service
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .eq("store_id", storeId),
    ]);

  const counts = {
    employees: employeeCount ?? 0,
    attendance: attendanceCount ?? 0,
  };

  console.log("[stores/delete] relatedCounts", counts);

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

  console.log("[stores/delete] executing delete SQL", { storeId });

  const result = await service
    .from("stores")
    .delete()
    .eq("id", storeId)
    .select("id, name");

  console.log("[stores/delete] deleteResult", result);

  if (result.error) {
    return errorResponse(500, "店舗の削除に失敗しました", result.error);
  }

  if (!result.data || result.data.length === 0) {
    return errorResponse(
      500,
      "店舗の削除に失敗しました（対象レコードが削除されませんでした）",
      { message: "no_rows_deleted", code: "PGRST116" }
    );
  }

  const { data: storeAfterDelete, error: verifyError } = await service
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .maybeSingle();

  console.log("[stores/delete] storeAfterDelete", { storeAfterDelete, verifyError });

  console.log("[stores/delete] success", {
    storeId,
    deleted: result.data[0],
  });

  return NextResponse.json({
    ok: true,
    deletedId: storeId,
    deletedName: result.data[0]?.name ?? store.name,
  });
}
