import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/AppError.js";
import type { PlatformAccount } from "../../../shared/types/domain.js";
import type { OAuthTokenResult, PlatformProvider, PublishPayload, PublishResult } from "./platform-provider.types.js";
import { buildMockPublish, buildMockToken, buildUrl, postForm, redirectUri } from "./provider-utils.js";

type MercadoLivreTokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  user_id?: number;
};

const scopes = ["offline_access", "write"];

export const mercadoLivreProvider: PlatformProvider = {
  platform: "mercadolivre",
  requiredScopes: scopes,
  isConfigured() {
    return Boolean(env.MERCADOLIVRE_CLIENT_ID && env.MERCADOLIVRE_CLIENT_SECRET);
  },
  getAuthUrl(state: string) {
    return buildUrl("https://auth.mercadolivre.com.br/authorization", {
      response_type: "code",
      client_id: env.MERCADOLIVRE_CLIENT_ID,
      redirect_uri: env.MERCADOLIVRE_REDIRECT_URI || redirectUri("mercadolivre"),
      state,
    });
  },
  async exchangeCode(code: string): Promise<OAuthTokenResult> {
    if (env.SOCIAL_INTEGRATIONS_MODE === "mock") return buildMockToken("mercadolivre", scopes);

    const token = await postForm<MercadoLivreTokenResponse>("https://api.mercadolibre.com/oauth/token", {
      grant_type: "authorization_code",
      client_id: env.MERCADOLIVRE_CLIENT_ID,
      client_secret: env.MERCADOLIVRE_CLIENT_SECRET,
      code,
      redirect_uri: env.MERCADOLIVRE_REDIRECT_URI || redirectUri("mercadolivre"),
    });

    return {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_type: token.token_type || "Bearer",
      expires_in: token.expires_in,
      provider_user_id: token.user_id ? String(token.user_id) : undefined,
      scopes,
      account_name: "Mercado Livre conectado",
    };
  },
  async publish(_account: PlatformAccount, payload: PublishPayload): Promise<PublishResult> {
    if (env.SOCIAL_INTEGRATIONS_MODE === "live") {
      throw new AppError(
        "Mercado Livre exige publicacao como anuncio/produto. O fluxo de post social nao se aplica a esta plataforma.",
        422,
        "MARKETPLACE_LISTING_REQUIRED",
      );
    }

    return buildMockPublish("mercadolivre", payload);
  },
};
