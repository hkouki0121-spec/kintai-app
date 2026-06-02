export const STORE_DELETE_BLOCKED_MESSAGE =
  "この店舗には関連データが存在するため削除できません。先に従業員・勤怠データを削除してください。";

export type StoreDeleteBlockReason = "employees" | "attendance" | "line_settings";

export function storeHasLineSettings(store: {
  line_group_id: string | null;
  line_user_id: string | null;
  line_notify_enabled: boolean;
}): boolean {
  return Boolean(
    store.line_group_id || store.line_user_id || store.line_notify_enabled
  );
}

export function resolveStoreDeleteBlockReasons(input: {
  employeeCount: number;
  attendanceCount: number;
  hasLineSettings: boolean;
}): StoreDeleteBlockReason[] {
  const reasons: StoreDeleteBlockReason[] = [];
  if (input.employeeCount > 0) reasons.push("employees");
  if (input.attendanceCount > 0) reasons.push("attendance");
  if (input.hasLineSettings) reasons.push("line_settings");
  return reasons;
}

const REASON_LABELS: Record<StoreDeleteBlockReason, string> = {
  employees: "従業員",
  attendance: "勤怠データ",
  line_settings: "LINEグループ設定",
};

export function formatStoreDeleteBlockMessage(
  reasons: StoreDeleteBlockReason[],
  counts: { employees: number; attendance: number }
): string {
  const parts = reasons.map((reason) => {
    if (reason === "employees") {
      return `${REASON_LABELS.employees} ${counts.employees} 件`;
    }
    if (reason === "attendance") {
      return `${REASON_LABELS.attendance} ${counts.attendance} 件`;
    }
    return REASON_LABELS.line_settings;
  });

  return `この店舗には関連データが存在するため削除できません（${parts.join("、")}）。先に従業員・勤怠データを削除し、LINE設定を解除してください。`;
}

export function describeStoreDeleteBlockReasons(
  reasons: StoreDeleteBlockReason[]
): string {
  return reasons.map((reason) => REASON_LABELS[reason]).join("、");
}
