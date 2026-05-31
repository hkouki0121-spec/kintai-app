import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLineEnvDiagnostics } from "@/lib/line/env";

export const dynamic = "force-dynamic";

/** 管理者向け: LINE 環境変数の設定状態（値は返さない） */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = getLineEnvDiagnostics();

  return NextResponse.json({
    config,
    hints: config.secretConfigured
      ? config.secretLooksLikeAccessToken
        ? [
            "LINE_CHANNEL_SECRET の値が Channel access token のように長すぎます（通常 32 文字前後）。",
            "LINE Developers Console > Basic settings > Channel secret を LINE_CHANNEL_SECRET に設定してください。",
            "LINE_CHANNEL_ACCESS_TOKEN とは別の値です。",
          ]
        : [
            "LINE_CHANNEL_SECRET は設定されています。Verify が 401 の場合、値が Channel secret（Basic settings）と一致しているか確認してください。",
            "環境変数追加後は Vercel で Redeploy が必要です。",
          ]
      : [
          "Vercel に LINE_CHANNEL_SECRET を追加してください（LINE Developers Console > Basic settings > Channel secret）。",
          "LINE_CHANNEL_ACCESS_TOKEN とは別の値です。混同しないでください。",
          "環境変数名は LINE_CHANNEL_SECRET（大文字）を推奨します。",
        ],
  });
}
