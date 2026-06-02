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
