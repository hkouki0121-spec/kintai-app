import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** 管理者向け: Bot が参加している LINE グループ一覧 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("line_groups")
    .select("id, group_id, group_name, last_seen_at")
    .order("last_seen_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ groups: data ?? [] });
}
