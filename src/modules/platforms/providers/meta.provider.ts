import { env } from "../../../config/env.js";
import type { PlatformAccount } from "../../../shared/types/domain.js";
import type { OAuthTokenResult, PlatformProvider, PublishPayload, PublishResult } from "./platform-provider.types.js";
import { buildMockPublish, buildMockToken, buildUrl, postForm, redirectUri } from "./provider-utils.js";

type MetaTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

export function createMetaProvider(platform: "instagram" | "facebook"): PlatformProvider {
  const scopes = platform === "instagram"
    ? ["instagram_basic", "instagram_content_publish", "pages_show_list", "pages_read_engagement"]
    : ["pages_manage_posts", "pages_read_engagement", "pages_show_list"];

  return {
    platform,
    requiredScopes: scopes,
    isConfigured() {
      return Boolean(env.META_CLIENT_ID && env.META_CLIENT_SECRET);
    },
    getAuthUrl(state: string) {
      return buildUrl("https://www.facebook.com/dialog/oauth", {
        client_id: env.META_CLIENT_ID,
        redirect_uri: env.META_REDIRECT_URI || redirectUri(platform),
        scope: scopes.join(","),
        response_type: "code",
        state,
      });
    },
    async exchangeCode(code: string): Promise<OAuthTokenResult> {
      if (env.SOCIAL_INTEGRATIONS_MODE === "mock") return buildMockToken(platform, scopes);

      const token = await postForm<MetaTokenResponse>(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/oauth/access_token`, {
        client_id: env.META_CLIENT_ID,
        client_secret: env.META_CLIENT_SECRET,
        redirect_uri: env.META_REDIRECT_URI || redirectUri(platform),
        code,
      });

      return {
        access_token: token.access_token,
        token_type: token.token_type || "Bearer",
        expires_in: token.expires_in,
        scopes,
        account_name: `${platform} conectado`,
      };
    },
    async publish(_account: PlatformAccount, payload: PublishPayload): Promise<PublishResult> {
      return buildMockPublish(platform, payload);
    },
  };
}
