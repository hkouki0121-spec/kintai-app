import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

type RegisterCompanyRequest = {
  companyName: string;
  email: string;
  password: string;
  adminName?: string;
};

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
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isValidRequest(body)) {
    return NextResponse.json(
      { error: "会社名・メール・パスワード（8文字以上）が必要です" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const companyName = body.companyName.trim();
  const email = body.email.trim().toLowerCase();
  const adminName = body.adminName?.trim() || companyName;

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: body.password,
    email_confirm: true,
    user_metadata: { name: adminName, full_name: adminName },
  });

  if (authError || !authData.user) {
    const message =
      authError?.message.includes("already registered") ||
      authError?.message.includes("already been registered")
        ? "このメールアドレスは既に登録されています"
        : authError?.message ?? "アカウント作成に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({ name: companyName })
    .select("id, name")
    .single();

  if (companyError || !company) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json(
      { error: companyError?.message ?? "会社作成に失敗しました" },
      { status: 500 }
    );
  }

  const { error: memberError } = await supabase.from("company_members").insert({
    user_id: authData.user.id,
    company_id: company.id,
    role: "company_admin",
  });

  if (memberError) {
    await supabase.from("companies").delete().eq("id", company.id);
    await supabase.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    companyId: company.id,
    companyName: company.name,
  });
}
