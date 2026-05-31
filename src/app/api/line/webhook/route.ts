import { NextResponse } from "next/server";
import {
  handleLineWebhookEvents,
  verifyLineWebhookSignature,
} from "@/lib/line/webhook-handler";
import { getLineEnvDiagnostics } from "@/lib/line/env";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function okResponse() {
  return NextResponse.json({ ok: true }, { status: 200 });
}

/** LINE Developers Console / 疎通確認（GET・HEAD） */
export async function GET() {
  const config = getLineEnvDiagnostics();

  return NextResponse.json(
    {
      ok: true,
      service: "line-webhook",
      config: {
        expectedSecretEnvVar: config.expectedSecretEnvVar,
        secretConfigured: config.secretConfigured,
        resolvedSecretEnvVar: config.resolvedSecretEnvVar,
        secretLength: config.secretLength,
        accessTokenConfigured: config.accessTokenConfigured,
      },
    },
    { status: 200 }
  );
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

/** LINE Messaging API Webhook（Bot 参加グループを自動登録） */
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-line-signature");
  const config = getLineEnvDiagnostics();

  if (!config.secretConfigured) {
    console.error("[line/webhook] LINE_CHANNEL_SECRET が未設定のため 401 を返します");
    return NextResponse.json(
      {
        error: "channel secret not configured",
        expectedEnvVar: config.expectedSecretEnvVar,
      },
      { status: 401 }
    );
  }

  if (!verifyLineWebhookSignature(body, signature)) {
    console.error("[line/webhook] signature verification failed", {
      resolvedSecretEnvVar: config.resolvedSecretEnvVar,
      secretLength: config.secretLength,
    });
    return NextResponse.json(
      {
        error: "invalid signature",
        expectedEnvVar: config.expectedSecretEnvVar,
        resolvedEnvVar: config.resolvedSecretEnvVar,
      },
      { status: 401 }
    );
  }

  try {
    const payload = JSON.parse(body) as Parameters<typeof handleLineWebhookEvents>[1];
    const supabase = createServiceClient();
    await handleLineWebhookEvents(supabase, payload);
  } catch (error) {
    console.error("[line/webhook]", error);
  }

  return okResponse();
}
