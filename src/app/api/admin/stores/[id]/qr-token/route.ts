import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildStoreQrUrl,
  generateQrToken,
  hashQrToken,
} from "@/lib/stores/qr-token";

function resolveAppBaseUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) return `https://${host}`;
  return "";
}

function resolveCorrectorName(user: { email?: string; user_metadata?: Record<string, unknown> }): string {
  const meta = user.user_metadata;
  if (meta && typeof meta.full_name === "string" && meta.full_name.trim()) {
    return meta.full_name.trim();
  }
  if (meta && typeof meta.name === "string" && meta.name.trim()) {
    return meta.name.trim();
  }
  return user.email ?? "管理者";
}

type RouteParams = { params: Promise<{ id: string }> };

/** 店舗QRトークンの状態確認 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("stores")
    .select("qr_token_hash, qr_token_updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    hasToken: !!data.qr_token_hash,
    updatedAt: data.qr_token_updated_at,
  });
}

/** 店舗QRトークンの再発行 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (storeError) {
    return NextResponse.json({ error: storeError.message }, { status: 500 });
  }
  if (!store) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const token = generateQrToken();
  const tokenHash = hashQrToken(token);
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("stores")
    .update({
      qr_token_hash: tokenHash,
      qr_token_updated_at: now,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const appBaseUrl = resolveAppBaseUrl(request);
  const qrUrl = buildStoreQrUrl(appBaseUrl || "https://example.com", token);

  return NextResponse.json({
    token,
    qrUrl,
    updatedAt: now,
    regeneratedBy: resolveCorrectorName(user),
    storeName: store.name,
  });
}
