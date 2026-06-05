import { NextResponse } from "next/server";

const DEFAULT_RECIPIENTS = ["h.kouki0121@icloud.com", "kouki.0121.07@icloud.com"];

type ContactPayload = {
  name: string;
  company: string;
  email: string;
  phone?: string;
  stores?: string;
  message?: string;
  type: "consultation" | "inquiry";
};

function isValidPayload(body: unknown): body is ContactPayload {
  if (!body || typeof body !== "object") return false;
  const value = body as ContactPayload;
  return (
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    typeof value.company === "string" &&
    value.company.trim().length > 0 &&
    typeof value.email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) &&
    (value.type === "consultation" || value.type === "inquiry")
  );
}

function buildEmailBody(data: ContactPayload): string {
  const typeLabel = data.type === "consultation" ? "無料相談" : "導入の問い合わせ";
  return [
    "勤怠管理アプリ LP からお問い合わせがありました。",
    "",
    `種別: ${typeLabel}`,
    `お名前: ${data.name.trim()}`,
    `店舗名・会社名: ${data.company.trim()}`,
    `メール: ${data.email.trim()}`,
    `電話: ${data.phone?.trim() || "（未入力）"}`,
    `店舗数: ${data.stores?.trim() || "（未入力）"}`,
    "",
    "ご相談内容:",
    data.message?.trim() || "（未入力）",
  ].join("\n");
}

async function sendViaResend(data: ContactPayload, recipients: string[]): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY が未設定です");
  }

  const from = process.env.CONTACT_FROM_EMAIL ?? "onboarding@resend.dev";
  const subject = `【勤怠管理アプリ】${data.type === "consultation" ? "無料相談" : "導入問い合わせ"} - ${data.company.trim()}`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: recipients,
      reply_to: data.email.trim(),
      subject,
      text: buildEmailBody(data),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`メール送信に失敗しました: ${errorBody}`);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!isValidPayload(body)) {
      return NextResponse.json({ error: "入力内容が不正です" }, { status: 400 });
    }

    const recipients =
      process.env.CONTACT_EMAIL_TO?.split(",").map((email) => email.trim()).filter(Boolean) ??
      DEFAULT_RECIPIENTS;

    await sendViaResend(body, recipients);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[lp/contact]", error);
    return NextResponse.json(
      { error: "送信に失敗しました。しばらくしてから再度お試しください。" },
      { status: 500 }
    );
  }
}
