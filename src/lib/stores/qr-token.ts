import { createHash, randomBytes } from "crypto";

export function generateQrToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashQrToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function buildStoreQrUrl(appBaseUrl: string, token: string): string {
  const base = appBaseUrl.replace(/\/$/, "");
  return `${base}/?storeQr=${encodeURIComponent(token)}`;
}

/** QRコード文字列からトークンを抽出 */
export function extractQrTokenFromScan(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get("storeQr");
    if (fromQuery) return fromQuery;
  } catch {
    // plain token
  }

  return trimmed;
}
