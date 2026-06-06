import { NextResponse } from "next/server";
import { getCompanyContext } from "@/lib/auth/company-context";
import { EMPLOYEE_SELECT_COLUMNS } from "@/lib/employees/constants";
import { assertUniqueEmployeeCode } from "@/lib/employees/duplicate-code";
import {
  formatEmployeeDbError,
  logEmployeeCreateError,
  validateEmployeeCode,
} from "@/lib/employees/format-error";
import { buildEmployeeInsertPayload } from "@/lib/employees/payload";
import { createClient } from "@/lib/supabase/server";

type CreateEmployeeBody = {
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
  console.error("[employees/create]", status, body);
  return NextResponse.json(body, { status });
}

/** 従業員登録 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const context = await getCompanyContext(supabase);

  if (!context) {
    return errorResponse(401, "ログインセッションが無効です。再度ログインしてください。");
  }

  let body: CreateEmployeeBody;
  try {
    body = (await request.json()) as CreateEmployeeBody;
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
  if (!store) {
    return errorResponse(404, "店舗が見つかりません。");
  }

  const companyId = store.company_id;
  if (!companyId) {
    return errorResponse(400, "会社が特定できません。");
  }

  try {
    await assertUniqueEmployeeCode(supabase, companyId, employeeCode);
  } catch (error) {
    const message = error instanceof Error ? error.message : "社員コードの確認に失敗しました";
    return errorResponse(400, message);
  }

  const payload = buildEmployeeInsertPayload({
    name,
    employeeCode,
    storeId,
    companyId,
    hourlyRate,
  });

  const { data, error } = await supabase
    .from("employees")
    .insert(payload)
    .select(`${EMPLOYEE_SELECT_COLUMNS}, stores(id, name)`)
    .single();

  if (error) {
    logEmployeeCreateError(error, { companyId, storeId, employeeCode });
    return errorResponse(400, formatEmployeeDbError(error), error);
  }

  return NextResponse.json({ employee: data });
}
