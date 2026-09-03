import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/** 指定店舗の顔認証用名簿。時給・給与は含めない */
export async function GET(request: Request) {
  const storeId = new URL(request.url).searchParams.get("storeId")?.trim();
  if (!storeId) {
    return NextResponse.json({ error: "storeId が必要です" }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const { data: store } = await supabase
      .from("stores")
      .select("id, company_id, is_active")
      .eq("id", storeId)
      .maybeSingle();
    if (!store || !store.is_active) {
      return NextResponse.json({ error: "store_not_found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("employees")
      .select("id, name, store_id, company_id, face_descriptor")
      .eq("is_active", true)
      .eq("store_id", storeId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ employees: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "roster_failed" },
      { status: 500 }
    );
  }
}
