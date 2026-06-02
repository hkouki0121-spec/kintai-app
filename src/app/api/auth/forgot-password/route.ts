import { NextResponse } from "next/server";
import { resolveAppBaseUrl } from "@/lib/auth/resolve-app-url";
import { createServiceClient } from "@/lib/supabase/service";

const SUCCESS_MESSAGE =
  "登録されているメールアドレスの場合、パスワード再設定用のメールを送信しました。メールをご確認ください。";

type ForgotPasswordRequest = {
  email: string;
};

function isValidRequest(body: unknown): body is ForgotPasswordRequest {
  return (
    !!body &&
    typeof body === "object" &&
    typeof (body as ForgotPasswordRequest).email === "string" &&
    (body as ForgotPasswordRequest).email.trim().length > 0
  );
}

/** パスワード再設定メール送信（存在しないアドレスでも同じ応答） */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true, message: SUCCESS_MESSAGE });
  }

  if (!isValidRequest(body)) {
    return NextResponse.json({ ok: true, message: SUCCESS_MESSAGE });
  }

  const email = body.email.trim().toLowerCase();
  const appBaseUrl = resolveAppBaseUrl(request);
  const redirectTo = appBaseUrl
    ? `${appBaseUrl}/admin/reset-password`
    : "/admin/reset-password";

  try {
    const supabase = createServiceClient();
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  } catch (error) {
    console.error("[auth/forgot-password]", error);
  }

  return NextResponse.json({ ok: true, message: SUCCESS_MESSAGE });
}
