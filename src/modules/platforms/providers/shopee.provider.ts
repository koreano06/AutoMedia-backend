import crypto from "node:crypto";
import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/AppError.js";
import type { PlatformAccount } from "../../../shared/types/domain.js";
import type { OAuthTokenResult, PlatformProvider, PublishPayload, PublishResult } from "./platform-provider.types.js";
import { buildMockPublish, buildMockToken, buildUrl, redirectUri } from "./provider-utils.js";

const scopes = ["shop_authorization", "product_write"];

function sign(path: string, timestamp: number) {
  const base = `${env.SHOPEE_PARTNER_ID || ""}${path}${timestamp}`;
  return crypto.createHmac("sha256", env.SHOPEE_PARTNER_KEY || "").update(base).digest("hex");
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
    return buildUrl(`https://partner.shopeemobile.com${path}`, {
      partner_id: env.SHOPEE_PARTNER_ID,
      timestamp,
      sign: sign(path, timestamp),
      redirect: env.SHOPEE_REDIRECT_URI || redirectUri("shopee"),
      state,
    });
  },
  async exchangeCode(code: string, extra?: Record<string, string | undefined>): Promise<OAuthTokenResult> {
    if (env.SOCIAL_INTEGRATIONS_MODE === "mock") return buildMockToken("shopee", scopes);

    return {
      access_token: code,
      refresh_token: undefined,
      token_type: "ShopeeCode",
      scopes,
      account_id: extra?.shop_id,
      provider_user_id: extra?.shop_id,
      account_name: extra?.shop_id ? `Shopee loja ${extra.shop_id}` : "Shopee conectado",
    };
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
