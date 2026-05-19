import crypto from "node:crypto";
import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/AppError.js";
import type { PlatformAccount } from "../../../shared/types/domain.js";
import type { OAuthTokenResult, PlatformProvider, PublishPayload, PublishResult } from "./platform-provider.types.js";
import { buildMockPublish, buildMockToken, buildUrl, redirectUri } from "./provider-utils.js";

const scopes = ["shop_authorization", "product_write"];

type ShopeeTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expire_in?: number;
  expires_in?: number;
  request_id?: string;
  error?: string;
  message?: string;
  shop_id?: number;
  merchant_id?: number;
};

type ShopeeShopInfoResponse = {
  request_id?: string;
  error?: string;
  message?: string;
  shop_name?: string;
  region?: string;
  status?: string;
  shop_id?: number;
};

function partnerId() {
  return Number(env.SHOPEE_PARTNER_ID || 0);
}

function sign(path: string, timestamp: number, accessToken?: string, shopId?: string | number) {
  const base = accessToken && shopId
    ? `${partnerId()}${path}${timestamp}${accessToken}${shopId}`
    : `${partnerId()}${path}${timestamp}`;
  return crypto.createHmac("sha256", env.SHOPEE_PARTNER_KEY || "").update(base).digest("hex");
}

function shopeeUrl(path: string, params: Record<string, string | number | undefined>) {
  return buildUrl(`${env.SHOPEE_API_BASE_URL}${path}`, params);
}

async function postShopee<T>(path: string, body: Record<string, string | number | undefined>, accessToken?: string, shopId?: string | number) {
  const timestamp = Math.floor(Date.now() / 1000);
  const url = shopeeUrl(path, {
    partner_id: partnerId(),
    timestamp,
    access_token: accessToken,
    shop_id: shopId,
    sign: sign(path, timestamp, accessToken, shopId),
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ partner_id: partnerId(), ...body }),
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: string; message?: string };

  if (!response.ok || payload.error) {
    throw new AppError(
      `Falha na Shopee API: ${payload.message || payload.error || response.statusText}`,
      response.ok ? 400 : response.status,
      "SHOPEE_API_ERROR",
    );
  }

  return payload as T;
}

async function getShopee<T>(path: string, accessToken: string, shopId: string | number) {
  const timestamp = Math.floor(Date.now() / 1000);
  const url = shopeeUrl(path, {
    partner_id: partnerId(),
    timestamp,
    access_token: accessToken,
    shop_id: shopId,
    sign: sign(path, timestamp, accessToken, shopId),
  });

  const response = await fetch(url);
  const payload = await response.json().catch(() => ({})) as T & { error?: string; message?: string };

  if (!response.ok || payload.error) {
    throw new AppError(
      `Falha na Shopee API: ${payload.message || payload.error || response.statusText}`,
      response.ok ? 400 : response.status,
      "SHOPEE_API_ERROR",
    );
  }

  return payload as T;
}

function requireShopAccount(account: PlatformAccount) {
  const shopId = account.account_id || account.provider_user_id;
  if (!account.access_token || !shopId) {
    throw new AppError("Conta Shopee sem access_token ou shop_id", 409, "SHOPEE_ACCOUNT_INCOMPLETE");
  }

  return { accessToken: account.access_token, shopId };
}

export const shopeeProvider: PlatformProvider = {
  platform: "shopee",
  requiredScopes: scopes,
  isConfigured() {
    return Boolean(env.SHOPEE_PARTNER_ID && env.SHOPEE_PARTNER_KEY);
  },
  getAuthUrl(state: string) {
    const path = "/api/v2/shop/auth_partner";
    const timestamp = Math.floor(Date.now() / 1000);
    return shopeeUrl(path, {
      partner_id: partnerId(),
      timestamp,
      sign: sign(path, timestamp),
      redirect: env.SHOPEE_REDIRECT_URI || redirectUri("shopee"),
      state,
    });
  },
  async exchangeCode(code: string, extra?: Record<string, string | undefined>): Promise<OAuthTokenResult> {
    if (env.SOCIAL_INTEGRATIONS_MODE === "mock") return buildMockToken("shopee", scopes);

    const shopId = extra?.shop_id;
    if (!shopId) {
      throw new AppError("A Shopee não retornou shop_id no callback OAuth", 400, "SHOPEE_SHOP_ID_MISSING");
    }

    const token = await postShopee<ShopeeTokenResponse>("/api/v2/auth/token/get", {
      code,
      shop_id: Number(shopId),
    });
    if (!token.access_token || !token.refresh_token) {
      throw new AppError("Shopee não retornou access_token/refresh_token", 502, "SHOPEE_TOKEN_MISSING");
    }

    return {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_type: "ShopeeOAuth",
      expires_in: token.expire_in || token.expires_in,
      scopes,
      account_id: String(token.shop_id || shopId),
      provider_user_id: String(token.shop_id || shopId),
      account_name: `Shopee loja ${token.shop_id || shopId}`,
    };
  },
  async refreshToken(account: PlatformAccount): Promise<OAuthTokenResult> {
    if (env.SOCIAL_INTEGRATIONS_MODE === "mock") return buildMockToken("shopee", scopes);
    if (!account.refresh_token) throw new AppError("Conta Shopee sem refresh_token", 409, "SHOPEE_REFRESH_TOKEN_MISSING");

    const { accessToken, shopId } = requireShopAccount(account);
    const token = await postShopee<ShopeeTokenResponse>("/api/v2/auth/access_token/get", {
      refresh_token: account.refresh_token,
      shop_id: Number(shopId),
    }, accessToken, shopId);

    if (!token.access_token || !token.refresh_token) {
      throw new AppError("Shopee não retornou novo access_token/refresh_token", 502, "SHOPEE_TOKEN_MISSING");
    }

    return {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_type: "ShopeeOAuth",
      expires_in: token.expire_in || token.expires_in,
      scopes,
      account_id: String(token.shop_id || shopId),
      provider_user_id: String(token.shop_id || shopId),
      account_name: `Shopee loja ${token.shop_id || shopId}`,
    };
  },
  async getAccountInfo(account: PlatformAccount) {
    if (env.SOCIAL_INTEGRATIONS_MODE === "mock") {
      return { shop_id: account.account_id || "mock_shopee_account", shop_name: account.account_name, status: "mock" };
    }

    const { accessToken, shopId } = requireShopAccount(account);
    return getShopee<ShopeeShopInfoResponse>("/api/v2/shop/get_shop_info", accessToken, shopId);
  },
  async publish(_account: PlatformAccount, payload: PublishPayload): Promise<PublishResult> {
    if (env.SOCIAL_INTEGRATIONS_MODE === "live") {
      throw new AppError(
        "Shopee exige criacao/atualizacao de item de catalogo. O fluxo de post social nao se aplica a esta plataforma.",
        422,
        "MARKETPLACE_LISTING_REQUIRED",
      );
    }

    return buildMockPublish("shopee", payload);
  },
};
