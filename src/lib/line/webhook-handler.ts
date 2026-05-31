import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
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
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;

  const digest = crypto.createHmac("SHA256", secret).update(body).digest("base64");
  return digest === signature;
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
