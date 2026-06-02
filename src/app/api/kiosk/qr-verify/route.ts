import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { extractQrTokenFromScan, hashQrToken } from "@/lib/stores/qr-token";

type VerifyRequest = {
  token: string;
};

function isValidRequest(body: unknown): body is VerifyRequest {
  return (
    !!body &&
    typeof body === "object" &&
    typeof (body as VerifyRequest).token === "string" &&
    (body as VerifyRequest).token.trim().length > 0
  );
}

async function findStoreByToken(supabase: ReturnType<typeof createServiceClient>, token: string) {
  const tokenHash = hashQrToken(extractQrTokenFromScan(token) ?? token);
  const { data, error } = await supabase
    .from("stores")
    .select("id, name, is_active, qr_token_hash, company_id")
    .eq("qr_token_hash", tokenHash)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || !data.is_active) return null;
  return data;
}

/** 店舗QRトークンの検証（キオスク用） */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isValidRequest(body)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const store = await findStoreByToken(supabase, body.token);
    if (!store) {
      return NextResponse.json({ error: "invalid_token" }, { status: 404 });
    }

    return NextResponse.json({
      storeId: store.id,
      storeName: store.name,
    });
  } catch (error) {
    console.error("[kiosk/qr-verify]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "verify_failed" },
      { status: 500 }
    );
  }
}
