const sensitiveKeys = [
  "password",
  "passwordhash",
  "token",
  "access_token",
  "refresh_token",
  "accessToken",
  "refreshToken",
  "authorization",
  "cookie",
  "secret",
  "client_secret",
  "partner_key",
  "api_key",
  "apikey",
  "webhook",
];

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function maskEmail(value: string) {
  return value.replace(/^(.).+(@.+)$/, "$1***$2");
}

function shouldRedactKey(key: string) {
  const normalizedKey = key.toLowerCase();
  return sensitiveKeys.some((sensitiveKey) => normalizedKey.includes(sensitiveKey.toLowerCase()));
}

export function redactSensitiveValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitiveValue);

  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if (shouldRedactKey(key)) return [key, "[REDACTED]"];
        return [key, redactSensitiveValue(item)];
      }),
    );
  }

  if (typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return maskEmail(value);
  }

  return value;
}

export function sanitizeExternalErrorPayload(payload: unknown) {
  const redacted = redactSensitiveValue(payload);

  if (typeof redacted === "string") {
    return redacted.slice(0, 400);
  }

  try {
    return JSON.stringify(redacted).slice(0, 400);
  } catch {
    return "External service error";
  }
}
