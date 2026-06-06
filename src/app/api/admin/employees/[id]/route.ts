import { NextResponse } from "next/server";
import { getCompanyContext } from "@/lib/auth/company-context";
import { EMPLOYEE_SELECT_COLUMNS } from "@/lib/employees/constants";
import { assertUniqueEmployeeCode } from "@/lib/employees/duplicate-code";
import {
  formatEmployeeDbError,
  logEmployeeCreateError,
  validateEmployeeCode,
} from "@/lib/employees/format-error";
import { buildEmployeeUpdatePayload } from "@/lib/employees/payload";
import { createClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ id: string }> };

type UpdateEmployeeBody = {
  name?: string;
  employeeCode?: string;
  storeId?: string;
  hourlyRate?: number | string;
};

function errorResponse(
  status: number,
  summary: string,
  source?: { message?: string; code?: string; details?: string } | null
) {
  const body = {
    error: summary,
    message: source?.message ?? summary,
    code: source?.code ?? null,
    details: source?.details ?? null,
  };
  console.error("[employees/update]", status, body);
  return NextResponse.json(body, { status });
}

/** 従業員更新 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id: employeeId } = await params;
  const supabase = await createClient();
  const context = await getCompanyContext(supabase);

  if (!context) {
    return errorResponse(401, "ログインセッションが無効です。再度ログインしてください。");
  }

  const { data: existing, error: existingError } = await supabase
    .from("employees")
    .select("id, company_id")
    .eq("id", employeeId)
    .maybeSingle();

  if (existingError) {
    return errorResponse(500, "従業員情報の取得に失敗しました", existingError);
  }
  if (!existing) {
    return errorResponse(404, "従業員が見つかりません。");
  }

  let body: UpdateEmployeeBody;
  try {
    body = (await request.json()) as UpdateEmployeeBody;
  } catch {
    return errorResponse(400, "リクエスト形式が不正です。");
  }

  const name = body.name?.trim() ?? "";
  const employeeCode = body.employeeCode?.trim() ?? "";
  const storeId = body.storeId?.trim() ?? "";
  const hourlyRate = Number(body.hourlyRate);

  if (!name) {
    return errorResponse(400, "氏名を入力してください。");
  }
  const codeError = validateEmployeeCode(employeeCode);
  if (codeError) {
    return errorResponse(400, codeError);
  }
  if (!storeId) {
    return errorResponse(400, "所属店舗を選択してください。");
  }
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
    return errorResponse(400, "時給を正しく入力してください。");
  }

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, company_id")
    .eq("id", storeId)
    .maybeSingle();

  if (storeError) {
    return errorResponse(500, "店舗情報の取得に失敗しました", storeError);
  }
  if (!store?.company_id) {
    return errorResponse(404, "店舗が見つかりません。");
  }

  try {
    await assertUniqueEmployeeCode(supabase, existing.company_id, employeeCode, employeeId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "社員コードの確認に失敗しました";
    return errorResponse(400, message);
  }

  const payload = buildEmployeeUpdatePayload({
    name,
    employeeCode,
    storeId,
    companyId: store.company_id,
    hourlyRate,
  });

  const { data, error } = await supabase
    .from("employees")
    .update(payload)
    .eq("id", employeeId)
    .select(`${EMPLOYEE_SELECT_COLUMNS}, stores(id, name)`)
    .single();

  if (error) {
    logEmployeeCreateError(error, { employeeId, storeId, employeeCode });
    return errorResponse(400, formatEmployeeDbError(error), error);
  }

  return NextResponse.json({ employee: data });
}
