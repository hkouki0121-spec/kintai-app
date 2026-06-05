import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/api/verify-cron-auth";
import { executeDailyBackup } from "@/lib/backup/run-daily-backup";
import { createServiceClient } from "@/lib/supabase/service";

/** 毎日深夜3時（JST）自動バックアップ（Vercel Cron: 18:00 UTC） */
export async function GET(request: Request) {
  const unauthorized = verifyCronAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const supabase = createServiceClient();
    const result = await executeDailyBackup(supabase);
    return NextResponse.json(result);
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
