import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/** キオスク店舗一覧。id と name のみ（他社の個人情報は返さない） */
export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("stores")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ stores: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "stores_failed" },
      { status: 500 }
    );
  }
}
