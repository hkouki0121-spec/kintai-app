import type { SupabaseClient } from "@supabase/supabase-js";
import { sendLinePushMessage } from "@/lib/line/send-message";

/** バックアップ失敗時に会社の LINE 通知先へ送信 */
export async function notifyBackupFailure(
  supabase: SupabaseClient,
  companyId: string,
  backupDate: string,
  errorMessage: string
): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!token) {
    console.warn("[backup] LINE_CHANNEL_ACCESS_TOKEN 未設定のため通知をスキップ");
    return;
  }

  const { data: stores } = await supabase
    .from("stores")
    .select("line_group_id, line_notify_enabled")
    .eq("company_id", companyId)
    .eq("line_notify_enabled", true)
    .not("line_group_id", "is", null);

  const groupId = stores?.find((store) => store.line_group_id?.trim())?.line_group_id?.trim();
  if (!groupId) {
    console.warn(`[backup] 会社 ${companyId} に LINE 通知先がありません`);
    return;
  }

  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle();

  const text = [
    "【バックアップ失敗】",
    `会社: ${company?.name ?? companyId}`,
    `日付: ${backupDate}`,
    `エラー: ${errorMessage.slice(0, 500)}`,
  ].join("\n");

  await sendLinePushMessage(groupId, text);
}
