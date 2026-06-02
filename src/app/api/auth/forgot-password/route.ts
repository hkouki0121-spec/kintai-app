import { NextResponse } from "next/server";
import { FORGOT_PASSWORD_SUCCESS_MESSAGE } from "@/lib/auth/forgot-password-messages";
import { findAuthUserByEmail } from "@/lib/auth/find-user-by-email";
import { resolveAppBaseUrl } from "@/lib/auth/resolve-app-url";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@supabase/supabase-js";

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

function createAuthMailClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/** パスワード再設定メール送信（未登録メールでも同じ成功応答） */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "リクエスト形式が不正です" },
      { status: 400 }
    );
  }

  if (!isValidRequest(body)) {
    return NextResponse.json(
      { ok: false, error: "メールアドレスを入力してください" },
      { status: 400 }
    );
  }

  const email = body.email.trim().toLowerCase();
  const appBaseUrl = resolveAppBaseUrl(request);

  if (!appBaseUrl) {
    const configError =
      "アプリURLが未設定です。NEXT_PUBLIC_APP_URL を設定してください。";
    console.error("[auth/forgot-password] missing app base URL", { email });
    return NextResponse.json({ ok: false, error: configError }, { status: 500 });
  }

  const redirectTo = `${appBaseUrl}/admin/reset-password`;

  try {
    const service = createServiceClient();
    const authUser = await findAuthUserByEmail(service, email);

    console.log("[auth/forgot-password] user lookup", {
      email,
      userExists: !!authUser,
      userId: authUser?.id ?? null,
      redirectTo,
    });

    if (!authUser) {
      return NextResponse.json({
        ok: true,
        message: FORGOT_PASSWORD_SUCCESS_MESSAGE,
        sent: false,
      });
    }

    const mailClient = createAuthMailClient();
    const { data, error } = await mailClient.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    console.log("[auth/forgot-password] resetPasswordForEmail", {
      email,
      redirectTo,
      data,
      error: error
        ? {
            message: error.message,
            status: error.status,
            code: error.code,
            name: error.name,
          }
        : null,
    });

    if (error) {
      const smtpHint =
        error.message.toLowerCase().includes("rate") ||
        error.message.toLowerCase().includes("email")
          ? " Supabase のメール送信制限（無料枠は時間あたり数通）または SMTP 設定を確認してください。"
          : "";

      return NextResponse.json(
        {
          ok: false,
          error: `${error.message}${smtpHint}`,
          code: error.code ?? null,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: FORGOT_PASSWORD_SUCCESS_MESSAGE,
      sent: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[auth/forgot-password] unexpected error", {
      email,
      message,
    });
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
