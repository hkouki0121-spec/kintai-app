import { NextResponse } from "next/server";
import { getCompanyContext } from "@/lib/auth/company-context";
import { normalizePayrollRoundingMinutes } from "@/lib/payroll/settings";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const context = await getCompanyContext(supabase);

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!context.companyId) {
    return NextResponse.json({ error: "会社が紐付いていません" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("companies")
    .select("id, name, payroll_rounding_minutes")
    .eq("id", context.companyId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "会社情報の取得に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({
    company: {
      id: data.id,
      name: data.name,
      payrollRoundingMinutes: normalizePayrollRoundingMinutes(data.payroll_rounding_minutes),
    },
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const context = await getCompanyContext(supabase);

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!context.companyId || context.isSuperAdmin) {
    return NextResponse.json({ error: "会社管理者のみ変更できます" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const rounding = (body as { payrollRoundingMinutes?: unknown }).payrollRoundingMinutes;
  const payrollRoundingMinutes = normalizePayrollRoundingMinutes(rounding);

  const { data, error } = await supabase
    .from("companies")
    .update({ payroll_rounding_minutes: payrollRoundingMinutes })
    .eq("id", context.companyId)
    .select("id, name, payroll_rounding_minutes")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "更新に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({
    company: {
      id: data.id,
      name: data.name,
      payrollRoundingMinutes: normalizePayrollRoundingMinutes(data.payroll_rounding_minutes),
    },
  });
}
