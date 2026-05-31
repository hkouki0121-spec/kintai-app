/** Webhook 署名検証で参照する Channel secret の環境変数名（優先順） */
export const LINE_CHANNEL_SECRET_ENV_KEYS = [
  "LINE_CHANNEL_SECRET",
  "LINE_SECRET",
  "CHANNEL_SECRET",
] as const;

export const LINE_CHANNEL_ACCESS_TOKEN_ENV_KEY = "LINE_CHANNEL_ACCESS_TOKEN";

function normalizeEnvValue(value: string): string {
  let normalized = value.trim();
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized;
}

export type LineChannelSecretConfig = {
  secret: string | null;
  envKey: (typeof LINE_CHANNEL_SECRET_ENV_KEYS)[number] | null;
};

/** Channel secret を環境変数から取得（引用符除去・複数名対応） */
export function getLineChannelSecret(): LineChannelSecretConfig {
  for (const envKey of LINE_CHANNEL_SECRET_ENV_KEYS) {
    const raw = process.env[envKey];
    if (!raw) continue;

    const secret = normalizeEnvValue(raw);
    if (secret) {
      return { secret, envKey };
    }
  }

  return { secret: null, envKey: null };
}

export function getLineChannelAccessToken(): string | null {
  const raw = process.env[LINE_CHANNEL_ACCESS_TOKEN_ENV_KEY];
  if (!raw) return null;
  const token = normalizeEnvValue(raw);
  return token || null;
}

export type LineEnvDiagnostics = {
  expectedSecretEnvVar: typeof LINE_CHANNEL_SECRET_ENV_KEYS[number];
  secretConfigured: boolean;
  resolvedSecretEnvVar: LineChannelSecretConfig["envKey"];
  secretLength: number | null;
  secretLooksLikeAccessToken: boolean;
  accessTokenConfigured: boolean;
  accessTokenEnvVar: typeof LINE_CHANNEL_ACCESS_TOKEN_ENV_KEY;
  checkedEnvVarNames: readonly string[];
};

export function getLineEnvDiagnostics(): LineEnvDiagnostics {
  const { secret, envKey } = getLineChannelSecret();
  const accessToken = getLineChannelAccessToken();

  return {
    expectedSecretEnvVar: "LINE_CHANNEL_SECRET",
    secretConfigured: Boolean(secret),
    resolvedSecretEnvVar: envKey,
    secretLength: secret?.length ?? null,
    secretLooksLikeAccessToken: Boolean(secret && secret.length > 64),
    accessTokenConfigured: Boolean(accessToken),
    accessTokenEnvVar: LINE_CHANNEL_ACCESS_TOKEN_ENV_KEY,
    checkedEnvVarNames: [...LINE_CHANNEL_SECRET_ENV_KEYS],
  };
}
