import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getLineChannelSecret } from "@/lib/line/env";
import { upsertLineGroup } from "@/lib/line/upsert-group";

type LineEventSource = {
  type?: string;
  groupId?: string;
  userId?: string;
};

type LineWebhookEvent = {
  type?: string;
  source?: LineEventSource;
};

type LineWebhookBody = {
  events?: LineWebhookEvent[];
};

export function verifyLineWebhookSignature(body: string, signature: string | null): boolean {
  const { secret, envKey } = getLineChannelSecret();
  const received = signature?.trim();

  if (!secret) {
    console.error(
      "[line/webhook] Channel secret 未設定。Vercel に LINE_CHANNEL_SECRET を設定してください（Channel access token ではありません）"
    );
    return false;
  }

  if (!received) {
    console.error("[line/webhook] x-line-signature ヘッダーがありません");
    return false;
  }

  const hash = crypto.createHmac("SHA256", secret).update(body).digest("base64");

  if (hash.length !== received.length) {
    console.error("[line/webhook] signature length mismatch", {
      envKey,
      secretLength: secret.length,
    });
    return false;
  }

  const isValid = crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(received));
  if (!isValid) {
    console.error("[line/webhook] signature mismatch", {
      envKey,
      secretLength: secret.length,
      bodyLength: body.length,
    });
  }

  return isValid;
}

function extractGroupId(event: LineWebhookEvent): string | null {
  if (event.source?.type !== "group") return null;
  const groupId = event.source.groupId?.trim();
  return groupId || null;
}

export async function handleLineWebhookEvents(
  supabase: SupabaseClient,
  body: LineWebhookBody
): Promise<void> {
  const events = body.events ?? [];

  for (const event of events) {
    const groupId = extractGroupId(event);
    if (!groupId) continue;

    const trackedTypes = new Set(["join", "memberJoined", "message", "postback"]);
    if (!trackedTypes.has(event.type ?? "")) continue;

    await upsertLineGroup(supabase, groupId);
  }
}
