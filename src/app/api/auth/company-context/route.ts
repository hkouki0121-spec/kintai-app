import { NextResponse } from "next/server";
import { getCompanyContext, getCompanyContextDiagnostics } from "@/lib/auth/company-context";
import { createClient } from "@/lib/supabase/server";

/** 管理者コンテキスト取得（クライアントキャッシュ用・1回だけ呼ぶ） */
export async function GET() {
  const supabase = await createClient();
  const context = await getCompanyContext(supabase);

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ context });
}

/** 開発環境のみ: company context 診断 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const diagnostics = await getCompanyContextDiagnostics(supabase);
  return NextResponse.json(diagnostics);
}
