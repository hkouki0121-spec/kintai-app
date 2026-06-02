import { NextResponse } from "next/server";
import type { AuthError, PostgrestError } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";

type RegisterCompanyRequest = {
  companyName: string;
  email: string;
  password: string;
  adminName?: string;
};

type RegisterErrorStep = "auth" | "company" | "member" | "validation";

type RegisterErrorBody = {
  error: string;
  step: RegisterErrorStep;
  message: string | null;
  code: string | null;
  details: string | null;
  hint: string | null;
};

function buildErrorResponse(
  step: RegisterErrorStep,
  summary: string,
  source: AuthError | PostgrestError | null | undefined,
  status: number
) {
  const body: RegisterErrorBody = {
    error: summary,
    step,
    message: source?.message ?? null,
    code:
      source && "code" in source && source.code != null
        ? String(source.code)
        : null,
    details:
      source && "details" in source && source.details
        ? String(source.details)
        : null,
    hint:
      source && "hint" in source && source.hint ? String(source.hint) : null,
  };

  console.error("[register-company]", step, body);

  return NextResponse.json(body, { status });
}

function isValidRequest(body: unknown): body is RegisterCompanyRequest {
  if (!body || typeof body !== "object") return false;
  const value = body as Record<string, unknown>;
  return (
    typeof value.companyName === "string" &&
    value.companyName.trim().length > 0 &&
    typeof value.email === "string" &&
    value.email.trim().length > 0 &&
    typeof value.password === "string" &&
    value.password.length >= 8
  );
}

/** 新規会社と会社管理者アカウントを作成 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return buildErrorResponse(
      "validation",
      "リクエスト形式が不正です",
      { message: "invalid_json", name: "ValidationError", status: 400 } as AuthError,
      400
    );
  }

  if (!isValidRequest(body)) {
    return buildErrorResponse(
      "validation",
      "会社名・メール・パスワード（8文字以上）が必要です",
      null,
      400
    );
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Supabase 設定エラー";
    return buildErrorResponse(
      "validation",
      message,
      { message, name: "ConfigError", status: 500 } as AuthError,
      500
    );
  }

  const companyName = body.companyName.trim();
  const email = body.email.trim().toLowerCase();
  const adminName = body.adminName?.trim() || companyName;

  console.log("[register-company] start", { email, companyName });

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: body.password,
    email_confirm: true,
    user_metadata: { name: adminName, full_name: adminName },
  });

  if (authError || !authData.user) {
    const summary =
      authError?.message.includes("already registered") ||
      authError?.message.includes("already been registered")
        ? "このメールアドレスは既に登録されています"
        : authError?.message ?? "アカウント作成に失敗しました";
    return buildErrorResponse("auth", summary, authError, 400);
  }

  console.log("[register-company] auth ok", { userId: authData.user.id });

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({ name: companyName })
    .select("id, name")
    .single();

  if (companyError || !company) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    return buildErrorResponse(
      "company",
      companyError?.message ?? "会社作成に失敗しました",
      companyError,
      500
    );
  }

  console.log("[register-company] company ok", { companyId: company.id });

  const { error: memberError } = await supabase.from("company_members").insert({
    user_id: authData.user.id,
    company_id: company.id,
    role: "company_admin",
  });

  if (memberError) {
    await supabase.from("companies").delete().eq("id", company.id);
    await supabase.auth.admin.deleteUser(authData.user.id);
    return buildErrorResponse("member", memberError.message, memberError, 500);
  }

  console.log("[register-company] success", {
    userId: authData.user.id,
    companyId: company.id,
  });

  return NextResponse.json({
    ok: true,
    companyId: company.id,
    companyName: company.name,
  });
}
