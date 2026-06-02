import type { SupabaseClient } from "@supabase/supabase-js";

export type RecoveryTokens = {
  type: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
};

function parseParamString(input: string): URLSearchParams {
  const normalized = input.startsWith("#") ? input.slice(1) : input;
  return new URLSearchParams(normalized);
}

/** URL から recovery 用トークンを抽出（hash / query 両対応） */
export function parseRecoveryTokensFromUrl(url: string | URL): RecoveryTokens {
  const parsed = typeof url === "string" ? new URL(url) : url;
  const hashParams = parseParamString(parsed.hash);
  const searchParams = parsed.searchParams;

  return {
    type: hashParams.get("type") ?? searchParams.get("type"),
    accessToken: hashParams.get("access_token") ?? searchParams.get("access_token"),
    refreshToken: hashParams.get("refresh_token") ?? searchParams.get("refresh_token"),
    code: searchParams.get("code"),
  };
}

function stripAuthParamsFromUrl(): void {
  if (typeof window === "undefined") return;
  window.history.replaceState(null, "", window.location.pathname);
}

export type EstablishRecoverySessionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Supabase パスワード再設定リンクからセッションを確立する。
 * - hash: access_token + refresh_token + type=recovery
 * - query: code (PKCE)
 */
export async function establishRecoverySession(
  supabase: SupabaseClient
): Promise<EstablishRecoverySessionResult> {
  const tokens = parseRecoveryTokensFromUrl(window.location.href);

  if (tokens.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(tokens.code);
    if (error) {
      return {
        ok: false,
        error: "リンクが無効または期限切れです。再度パスワード再設定を申請してください。",
      };
    }
    stripAuthParamsFromUrl();
    return { ok: true };
  }

  if (
    tokens.type === "recovery" &&
    tokens.accessToken &&
    tokens.refreshToken
  ) {
    const { error } = await supabase.auth.setSession({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });
    if (error) {
      return {
        ok: false,
        error: "リンクが無効または期限切れです。再度パスワード再設定を申請してください。",
      };
    }
    stripAuthParamsFromUrl();
    return { ok: true };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    return { ok: true };
  }

  return {
    ok: false,
    error: "再設定リンクが無効です。パスワード再設定を再度お試しください。",
  };
}
