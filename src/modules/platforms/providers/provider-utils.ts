import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/AppError.js";
import type { OAuthTokenResult, PlatformProvider, PublishPayload, PublishResult } from "./platform-provider.types.js";
import { sanitizeExternalErrorPayload } from "../../../shared/utils/redact.js";

export function buildUrl(baseUrl: string, params: Record<string, string | number | undefined>) {
  const url = new URL(baseUrl);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

export function redirectUri(platform: string) {
  return `${env.API_PUBLIC_URL}/api/platform-callback?platform=${platform}`;
}

export function ensureConfigured(provider: PlatformProvider) {
  if (!provider.isConfigured()) {
    throw new AppError(`Credenciais de ${provider.platform} não configuradas no backend`, 503, "PLATFORM_NOT_CONFIGURED");
  }
}

export function buildMockToken(platform: string, scopes: string[]): OAuthTokenResult {
  return {
    access_token: `mock_${platform}_access_${Date.now()}`,
    refresh_token: `mock_${platform}_refresh_${Date.now()}`,
    token_type: "Bearer",
    expires_in: 60 * 60 * 24 * 30,
    scopes,
    account_id: `mock_${platform}_account`,
    provider_user_id: `mock_${platform}_user`,
    account_name: `${platform} conectado`,
  };
}

export function buildMockPublish(platform: string, payload: PublishPayload): PublishResult {
  const id = `${platform}_${Date.now().toString(36)}`;
  return {
    external_post_id: id,
    external_url: `https://example.com/${platform}/posts/${id}`,
    status: payload.scheduled_at ? "scheduled" : "published",
    message: `Publicação simulada em ${platform}. Configure credenciais reais para enviar pela API oficial.`,
  };
}

export async function postForm<T>(url: string, body: Record<string, string | undefined>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(Object.entries(body).filter((entry): entry is [string, string] => Boolean(entry[1]))),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AppError(`Falha OAuth: ${sanitizeExternalErrorPayload(payload)}`, response.status, "OAUTH_EXCHANGE_FAILED");
  }

  return payload as T;
}

export function getBearerToken(account: { access_token?: string; platform?: string }) {
  if (!account.access_token) {
    throw new AppError(`Conta ${account.platform || ""} sem token de acesso`, 409, "PLATFORM_TOKEN_MISSING");
  }

  return account.access_token;
}

export function requirePublicMediaUrl(payload: PublishPayload, platform: string) {
  if (!payload.media_url || !/^https:\/\//i.test(payload.media_url)) {
    throw new AppError(
      `${platform} exige uma URL publica HTTPS da midia para publicar pela API oficial`,
      422,
      "PUBLIC_MEDIA_URL_REQUIRED",
    );
  }

  return payload.media_url;
}

export function captionFor(payload: PublishPayload, maxLength = 2200) {
  return (payload.caption || payload.product_name || "Novo conteudo").slice(0, maxLength);
}

export async function getJson<T>(url: string, accessToken?: string) {
  const response = await fetch(url, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AppError(`Falha na API externa: ${sanitizeExternalErrorPayload(payload)}`, response.status, "EXTERNAL_API_ERROR");
  }

  return payload as T;
}

export async function postJson<T>(url: string, body: unknown, accessToken?: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AppError(`Falha na API externa: ${sanitizeExternalErrorPayload(payload)}`, response.status, "EXTERNAL_API_ERROR");
  }

  return payload as T;
}

export async function postGraphForm<T>(url: string, body: Record<string, string | number | boolean | undefined>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(
      Object.entries(body)
        .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
        .map(([key, value]) => [key, String(value)]),
    ),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AppError(`Falha na API externa: ${sanitizeExternalErrorPayload(payload)}`, response.status, "EXTERNAL_API_ERROR");
  }

  return payload as T;
}
