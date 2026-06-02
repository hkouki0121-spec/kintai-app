import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type UpdatePasswordRequest = {
  password: string;
};

function isValidRequest(body: unknown): body is UpdatePasswordRequest {
  return (
    !!body &&
    typeof body === "object" &&
    typeof (body as UpdatePasswordRequest).password === "string" &&
    (body as UpdatePasswordRequest).password.length >= 8
  );
}

/** パスワード再設定（recovery セッション必須） */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isValidRequest(body)) {
    return NextResponse.json(
      { error: "パスワードは8文字以上で入力してください" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const {
    data: { session: sessionBefore },
  } = await supabase.auth.getSession();
  console.log("[auth/update-password] getSession(before)", {
    hasSession: !!sessionBefore,
    userId: sessionBefore?.user?.id ?? null,
    expiresAt: sessionBefore?.expires_at ?? null,
  });

  const {
    data: { user: userBefore },
    error: userBeforeError,
  } = await supabase.auth.getUser();
  console.log("[auth/update-password] getUser(before)", {
    userId: userBefore?.id ?? null,
    error: userBeforeError?.message ?? null,
  });

  if (userBeforeError || !userBefore) {
    return NextResponse.json(
      {
        error:
          userBeforeError?.message ??
          "セッションが無効です。パスワード再設定を最初からやり直してください。",
      },
      { status: 401 }
    );
  }

  const { data: refreshData, error: refreshError } =
    await supabase.auth.refreshSession();
  console.log("[auth/update-password] refreshSession", {
    hasSession: !!refreshData.session,
    error: refreshError?.message ?? null,
  });

  if (refreshError) {
    return NextResponse.json({ error: refreshError.message }, { status: 401 });
  }

  const {
    data: { session: sessionAfterRefresh },
  } = await supabase.auth.getSession();
  console.log("[auth/update-password] getSession(after refresh)", {
    hasSession: !!sessionAfterRefresh,
    userId: sessionAfterRefresh?.user?.id ?? null,
  });

  const { data: updateData, error: updateError } = await supabase.auth.updateUser({
    password: body.password,
  });
  console.log("[auth/update-password] updateUser", {
    userId: updateData.user?.id ?? null,
    error: updateError?.message ?? null,
    status: updateError?.status ?? null,
    code: updateError?.code ?? null,
  });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
