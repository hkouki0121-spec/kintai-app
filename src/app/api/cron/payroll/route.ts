import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getCurrentMonthInJst,
  isLastDayOfMonthInJst,
} from "@/lib/payroll/calculate";
import { runMonthlyPayroll } from "@/lib/payroll/run-monthly";

/** 月末自動給与計算（Vercel Cron 等から呼び出し） */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isLastDayOfMonthInJst()) {
    return NextResponse.json({
      skipped: true,
      message: "月末以外のためスキップしました",
    });
  }

  const { year, month } = getCurrentMonthInJst();

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY が未設定です" }, { status: 500 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

  try {
    const result = await runMonthlyPayroll(supabase, year, month);
    return NextResponse.json({
      success: true,
      year,
      month,
      ...result,
    });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
