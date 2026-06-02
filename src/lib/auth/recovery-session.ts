import type { SupabaseClient, Session } from "@supabase/supabase-js";

export type RecoveryTokens = {
  type: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
};

const RECOVERY_STORAGE_KEY = "kintai-recovery-session";

type StoredRecoverySession = {
  access_token: string;
  refresh_token: string;
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

function storeRecoverySession(session: Session): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    RECOVERY_STORAGE_KEY,
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    } satisfies StoredRecoverySession)
  );
}

export function clearStoredRecoverySession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
}

/** 保存済み recovery セッションを復元（cookie 未同期時のフォールバック） */
export async function restoreStoredRecoverySession(
  supabase: SupabaseClient
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const raw = sessionStorage.getItem(RECOVERY_STORAGE_KEY);
  if (!raw) return false;

  try {
    const stored = JSON.parse(raw) as StoredRecoverySession;
    const { data, error } = await supabase.auth.setSession({
      access_token: stored.access_token,
      refresh_token: stored.refresh_token,
    });
    if (error || !data.session) return false;
    return true;
  } catch {
    return false;
  }
}

async function verifyActiveSession(
  supabase: SupabaseClient
): Promise<{ ok: true; session: Session } | { ok: false; error: string }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      error: "セッションの確立に失敗しました。リンクの有効期限を確認してください。",
    };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      ok: false,
      error: "セッションの確立に失敗しました。リンクの有効期限を確認してください。",
    };
  }

  return { ok: true, session };
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
    const { data, error } = await supabase.auth.exchangeCodeForSession(tokens.code);
    if (error) {
      return {
        ok: false,
        error: "リンクが無効または期限切れです。再度パスワード再設定を申請してください。",
      };
    }
    stripAuthParamsFromUrl();
    if (data.session) storeRecoverySession(data.session);
    return verifyActiveSession(supabase);
  }

  if (
    tokens.type === "recovery" &&
    tokens.accessToken &&
    tokens.refreshToken
  ) {
    const { data, error } = await supabase.auth.setSession({
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
    if (data.session) storeRecoverySession(data.session);

    const verified = await verifyActiveSession(supabase);
    if (!verified.ok) return verified;

    await supabase.auth.refreshSession();
    return { ok: true };
  }

  const verified = await verifyActiveSession(supabase);
  if (verified.ok) {
    storeRecoverySession(verified.session);
    return { ok: true };
  }

  const restored = await restoreStoredRecoverySession(supabase);
  if (restored) {
    return verifyActiveSession(supabase);
  }

  return {
    ok: false,
    error: "再設定リンクが無効です。パスワード再設定を再度お試しください。",
  };
}
