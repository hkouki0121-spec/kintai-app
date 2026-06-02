import { NextResponse } from "next/server";
import { getCompanyContext } from "@/lib/auth/company-context";
import {
  STORE_DELETE_BLOCKED_MESSAGE,
  resolveStoreDeleteBlockReasons,
  storeHasLineSettings,
} from "@/lib/stores/delete-store";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type RouteParams = { params: Promise<{ id: string }> };

/** 店舗削除（company_admin のみ・関連データがある場合は不可） */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const context = await getCompanyContext(supabase);

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (context.isSuperAdmin || context.role !== "company_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!context.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceClient();

  const { data: store, error: storeError } = await service
    .from("stores")
    .select(
      "id, company_id, line_group_id, line_user_id, line_notify_enabled"
    )
    .eq("id", id)
    .maybeSingle();

  if (storeError) {
    return NextResponse.json({ error: storeError.message }, { status: 500 });
  }

  if (!store) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (store.company_id !== context.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const blockReasons = resolveStoreDeleteBlockReasons({
    employeeCount: employeeCount ?? 0,
    attendanceCount: attendanceCount ?? 0,
    hasLineSettings: storeHasLineSettings(store),
  });

  if (blockReasons.length > 0) {
    return NextResponse.json(
      { error: STORE_DELETE_BLOCKED_MESSAGE, reasons: blockReasons },
      { status: 400 }
    );
  }

  const { error: deleteError } = await service.from("stores").delete().eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
