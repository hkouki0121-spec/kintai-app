import { NextResponse } from "next/server";
import { getCompanyContext } from "@/lib/auth/company-context";
import {
  buildPayrollCsvFilename,
  buildPayrollCsvContent,
} from "@/lib/csv/build-payroll-csv";
import {
  parsePayrollCsvQueryParams,
  payrollRowsToCsvRows,
  isAllStores,
} from "@/lib/csv/payroll-csv-query";
import { fetchPayrollForPeriod } from "@/lib/payroll/fetch-payroll";
import { syncPayrollFromAttendance } from "@/lib/payroll/sync-from-attendance";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { PayrollWithEmployee } from "@/types/database";

const CSV_EXPORT_ERROR =
  "CSV出力に失敗しました。時間を置いて再度お試しください。";

type PayrollWithCompany = PayrollWithEmployee & {
  companies?: { name: string } | null;
};

/** 給与CSV出力（company_admin のみ・自社データのみ） */
export async function GET(request: Request) {
  const supabase = await createClient();
  const context = await getCompanyContext(supabase);

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (context.isSuperAdmin || context.role !== "company_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!context.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = parsePayrollCsvQueryParams(new URL(request.url).searchParams);
  if (!params) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const { storeId, year, month } = params;

  if (!isAllStores(storeId)) {
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, name, company_id")
      .eq("id", storeId)
      .maybeSingle();

    if (storeError || !store) {
      return NextResponse.json({ error: CSV_EXPORT_ERROR }, { status: 404 });
    }

    if (store.company_id !== context.companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let storeLabel = "全店舗";
  if (!isAllStores(storeId)) {
    const { data: store } = await supabase
      .from("stores")
      .select("name")
      .eq("id", storeId)
      .maybeSingle();
    storeLabel = store?.name ?? "店舗";
  }

  let payroll: PayrollWithCompany[];
  try {
    const serviceSupabase = createServiceClient();
    await syncPayrollFromAttendance(
      serviceSupabase,
      year,
      month,
      isAllStores(storeId) ? null : storeId,
      context.companyId,
      storeLabel
    );
    const rows = await fetchPayrollForPeriod(
      serviceSupabase,
      year,
      month,
      storeId,
      context.companyId
    );
    payroll = rows.map((row) => ({
      ...row,
      companies: context.companyName ? { name: context.companyName } : null,
    }));
  } catch (error) {
    console.error("[payroll/csv]", error);
    return NextResponse.json({ error: CSV_EXPORT_ERROR }, { status: 500 });
  }

  if (payroll.length === 0) {
    return NextResponse.json({ error: "出力する給与データがありません" }, { status: 404 });
  }

  const companyName = context.companyName ?? payroll[0]?.companies?.name ?? "";

  try {
    const csv = buildPayrollCsvContent(payrollRowsToCsvRows(payroll, companyName));
    const filename = buildPayrollCsvFilename(year, month, storeLabel);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (e) {
    console.error("[payroll/csv]", e);
    return NextResponse.json({ error: CSV_EXPORT_ERROR }, { status: 500 });
  }
}
