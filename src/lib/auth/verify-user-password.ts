import { createClient } from "@supabase/supabase-js";

/** 既存 Auth ユーザーのパスワードを anon キーで検証する */
export async function verifyUserPassword(
  email: string,
  password: string
): Promise<{ ok: true; userId: string } | { ok: false; message: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return { ok: false, message: "Supabase 設定エラー" };
  }

  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await anon.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error || !data.user) {
    return { ok: false, message: "メールアドレスまたはパスワードが正しくありません" };
  }

  return { ok: true, userId: data.user.id };
}
