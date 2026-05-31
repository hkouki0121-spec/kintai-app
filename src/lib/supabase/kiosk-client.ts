import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * キオスク用 Supabase クライアント。
 * 管理画面の Auth Cookie / localStorage を参照せず、常に anon ロールで API を呼ぶ。
 */
export function createKioskClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}

/** PostgREST / auth.role() と同等の JWT ロールを返す */
export async function getSupabaseAuthRole(
  supabase: SupabaseClient
): Promise<"anon" | "authenticated"> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return "anon";
  }

  try {
    const payload = JSON.parse(atob(session.access_token.split(".")[1] ?? "")) as {
      role?: string;
    };
    return payload.role === "authenticated" ? "authenticated" : "anon";
  } catch {
    return "authenticated";
  }
}
