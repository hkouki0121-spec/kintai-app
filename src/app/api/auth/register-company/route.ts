import { NextResponse } from "next/server";
import type { AuthError, PostgrestError } from "@supabase/supabase-js";
import { findAuthUserByEmail } from "@/lib/auth/find-user-by-email";
import { insertCompanyMember } from "@/lib/auth/register-company-member";
import { verifyUserPassword } from "@/lib/auth/verify-user-password";
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

function isAlreadyRegistered(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("already registered") ||
    message.includes("already been registered")
  );
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

async function createCompanyWithMember(
  supabase: ReturnType<typeof createServiceClient>,
  params: {
    userId: string;
    companyName: string;
    email: string;
  }
) {
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({ name: params.companyName })
    .select("id, name")
    .single();

  if (companyError || !company) {
    console.error("[register-company] company insert failed", companyError);
    return {
      ok: false as const,
      step: "company" as const,
      summary: companyError?.message ?? "会社作成に失敗しました",
      source: companyError,
    };
  }

  console.log("[register-company] company ok", {
    companyId: company.id,
    name: company.name,
    email: params.email,
  });

  const { member, error: memberError } = await insertCompanyMember(supabase, {
    userId: params.userId,
    companyId: company.id,
  });

  if (memberError || !member) {
    await supabase.from("companies").delete().eq("id", company.id);
    return {
      ok: false as const,
      step: "member" as const,
      summary: memberError?.message ?? "会社への紐付けに失敗しました",
      source: memberError,
    };
  }

  return {
    ok: true as const,
    company,
    member,
  };
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

  let userId: string;
  let reusedExistingUser = false;

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: body.password,
    email_confirm: true,
    user_metadata: { name: adminName, full_name: adminName },
  });

  if (authError || !authData.user) {
    if (!isAlreadyRegistered(authError?.message)) {
      return buildErrorResponse(
        "auth",
        authError?.message ?? "アカウント作成に失敗しました",
        authError,
        400
      );
    }

    console.log("[register-company] email exists, trying existing-user flow", {
      email,
    });

    const existingUser = await findAuthUserByEmail(supabase, email);
    if (!existingUser) {
      return buildErrorResponse(
        "auth",
        "このメールアドレスは既に登録されています",
        authError,
        400
      );
    }

    const passwordCheck = await verifyUserPassword(email, body.password);
    if (!passwordCheck.ok) {
      return buildErrorResponse(
        "auth",
        "このメールアドレスは既に登録されています。ログイン用パスワードが一致しません。",
        authError,
        400
      );
    }

    if (passwordCheck.userId !== existingUser.id) {
      return buildErrorResponse(
        "auth",
        "アカウント確認に失敗しました",
        authError,
        400
      );
    }

    const { data: existingMember, error: existingMemberError } = await supabase
      .from("company_members")
      .select("id, company_id, role")
      .eq("user_id", existingUser.id)
      .maybeSingle();

    if (existingMemberError) {
      return buildErrorResponse(
        "member",
        existingMemberError.message,
        existingMemberError,
        500
      );
    }

    if (existingMember) {
      return buildErrorResponse(
        "auth",
        "このメールアドレスは既に会社に紐付けられています。ログインしてください。",
        authError,
        400
      );
    }

    userId = existingUser.id;
    reusedExistingUser = true;
    console.log("[register-company] existing auth user without member", {
      userId,
      email,
    });
  } else {
    userId = authData.user.id;
    console.log("[register-company] auth ok", { userId, email });
  }

  const result = await createCompanyWithMember(supabase, {
    userId,
    companyName,
    email,
  });

  if (!result.ok) {
    if (!reusedExistingUser) {
      await supabase.auth.admin.deleteUser(userId);
    }
    return buildErrorResponse(result.step, result.summary, result.source, 500);
  }

  console.log("[register-company] success", {
    userId,
    companyId: result.company.id,
    memberId: result.member.id,
    role: result.member.role,
    reusedExistingUser,
  });

  return NextResponse.json({
    ok: true,
    companyId: result.company.id,
    companyName: result.company.name,
    memberId: result.member.id,
    role: result.member.role,
    reusedExistingUser,
  });
}
