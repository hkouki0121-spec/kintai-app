import { NextResponse } from "next/server";
import {
  handleLineWebhookEvents,
  verifyLineWebhookSignature,
} from "@/lib/line/webhook-handler";
import { createServiceClient } from "@/lib/supabase/service";

/** LINE Developers Console の接続確認（GET） */
export async function GET() {
  return NextResponse.json({ ok: true, service: "line-webhook" }, { status: 200 });
}

/** LINE Messaging API Webhook（Bot 参加グループを自動登録） */
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!verifyLineWebhookSignature(body, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(body) as Parameters<typeof handleLineWebhookEvents>[1];
    const supabase = createServiceClient();
    await handleLineWebhookEvents(supabase, payload);
  } catch (error) {
    console.error("[line/webhook]", error);
  }

  // LINE は 200 以外をエラー扱いするため、処理失敗時も 200 を返す
  return NextResponse.json({ ok: true }, { status: 200 });
}
