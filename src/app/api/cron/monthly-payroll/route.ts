import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/api/verify-cron-auth";
import { executeMonthlyPayrollCron } from "@/lib/payroll/run-monthly-cron";

/** 月末自動給与計算（Vercel Cron） */
export async function GET(request: Request) {
  const unauthorized = verifyCronAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await executeMonthlyPayrollCron();
    return NextResponse.json(result);
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
