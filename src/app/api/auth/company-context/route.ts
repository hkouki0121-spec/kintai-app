import { NextResponse } from "next/server";
import { getCompanyContextDiagnostics } from "@/lib/auth/company-context";
import { createClient } from "@/lib/supabase/server";

/** 開発環境のみ: company context 診断（Vercel Logs 用） */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const diagnostics = await getCompanyContextDiagnostics(supabase);
  return NextResponse.json(diagnostics);
}
