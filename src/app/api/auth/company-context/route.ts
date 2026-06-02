import { NextResponse } from "next/server";
import { getCompanyContextDiagnostics } from "@/lib/auth/company-context";
import { createClient } from "@/lib/supabase/server";

/** ログイン後の company context 診断（Vercel Logs / 画面デバッグ用） */
export async function GET() {
  const supabase = await createClient();
  const diagnostics = await getCompanyContextDiagnostics(supabase);
  return NextResponse.json(diagnostics);
}
