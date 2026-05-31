import type { SupabaseClient } from "@supabase/supabase-js";

export function defaultGroupName(groupId: string): string {
  return `グループ ${groupId.slice(0, 10)}…`;
}

export async function upsertLineGroup(
  supabase: SupabaseClient,
  groupId: string,
  groupName?: string | null
): Promise<void> {
  const { error } = await supabase.from("line_groups").upsert(
    {
      group_id: groupId,
      group_name: groupName?.trim() || defaultGroupName(groupId),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "group_id" }
  );

  if (error) {
    throw new Error(error.message);
  }
}
