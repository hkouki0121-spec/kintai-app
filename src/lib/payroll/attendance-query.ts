import type { SupabaseClient } from "@supabase/supabase-js";
import { getPayrollMonthRange } from "@/lib/payroll/month-range";
import type { PayrollScope } from "@/lib/payroll/resolve-scope";
import { isAllStores } from "@/lib/stores/queries";

export type AttendanceRecordRow = {
  id: string;
  employee_id: string;
  store_id: string;
  company_id: string;
  clock_in: string;
  clock_out: string | null;
};

export type AttendanceQueryMeta = {
  dateFrom: string;
  dateTo: string;
  storeId: string | null;
  accessibleStoreIds: string[];
  dataCompanyIds: string[];
  filterDescription: string;
  readMode: "rls" | "service";
};

export type AttendanceQueryResult = {
  records: AttendanceRecordRow[];
  meta: AttendanceQueryMeta;
  error: { message: string; code: string | null; details: string | null } | null;
};

function buildAttendanceQueryDescription(
  scope: Pick<PayrollScope, "storeId" | "accessibleStoreIds" | "dataCompanyIds">,
  range: { dateFrom: string; dateTo: string },
  readMode: "rls" | "service"
): string {
  const datePart = `clock_in >= ${range.dateFrom} AND clock_in < ${range.dateTo}`;
  if (!isAllStores(scope.storeId)) {
    return `${datePart}; store_id = ${scope.storeId}`;
  }
  if (readMode === "rls") {
    return `${datePart}; (RLS — 勤怠履歴と同条件・店舗/company フィルタなし)`;
  }
  if (scope.accessibleStoreIds.length > 0) {
    return `${datePart}; store_id IN (${scope.accessibleStoreIds.join(",")})`;
  }
  if (scope.dataCompanyIds.length > 0) {
    return `${datePart}; company_id IN (${scope.dataCompanyIds.join(",")})`;
  }
  return `${datePart}; (no store/company filter)`;
}

/**
 * 勤怠履歴画面と同条件で attendance_records を取得。
 * readMode=rls のときは認証クライアント＋RLS（日付＋任意の store_id のみ）。
 */
export async function fetchAttendanceRecordsInScope(
  supabase: SupabaseClient,
  year: number,
  month: number,
  scope: PayrollScope,
  readMode: "rls" | "service" = "rls"
): Promise<AttendanceQueryResult> {
  const range = getPayrollMonthRange(year, month);
  const meta: AttendanceQueryMeta = {
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    storeId: scope.storeId,
    accessibleStoreIds: scope.accessibleStoreIds,
    dataCompanyIds: scope.dataCompanyIds,
    filterDescription: buildAttendanceQueryDescription(scope, range, readMode),
    readMode,
  };

  let query = supabase
    .from("attendance_records")
    .select("id, employee_id, store_id, company_id, clock_in, clock_out")
    .gte("clock_in", range.dateFrom)
    .lt("clock_in", range.dateTo);

  if (!isAllStores(scope.storeId)) {
    query = query.eq("store_id", scope.storeId!);
  } else if (readMode === "service") {
    if (scope.accessibleStoreIds.length > 0) {
      query = query.in("store_id", scope.accessibleStoreIds);
    } else if (scope.dataCompanyIds.length > 0) {
      query = query.in("company_id", scope.dataCompanyIds);
    }
  }

  const { data, error } = await query.order("clock_in", { ascending: true });

  return {
    records: (data as AttendanceRecordRow[]) ?? [],
    meta,
    error: error
      ? {
          message: error.message,
          code: error.code ?? null,
          details: error.details ?? null,
        }
      : null,
  };
}

/** 1従業員の対象月勤怠（勤怠履歴と同じ clock_in 範囲） */
export async function fetchEmployeeAttendanceInMonth(
  supabase: SupabaseClient,
  employeeId: string,
  year: number,
  month: number
): Promise<AttendanceRecordRow[]> {
  const range = getPayrollMonthRange(year, month);
  const { data, error } = await supabase
    .from("attendance_records")
    .select("id, employee_id, store_id, company_id, clock_in, clock_out")
    .eq("employee_id", employeeId)
    .gte("clock_in", range.dateFrom)
    .lt("clock_in", range.dateTo)
    .order("clock_in", { ascending: true });
  if (error) throw error;
  return (data as AttendanceRecordRow[]) ?? [];
}
