import { env } from "../../../config/env.js";
import type { PlatformAccount } from "../../../shared/types/domain.js";
import type { OAuthTokenResult, PlatformProvider, PublishPayload, PublishResult } from "./platform-provider.types.js";
import { buildMockPublish, buildMockToken, buildUrl, postForm, redirectUri } from "./provider-utils.js";

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
};

const scopes = ["https://www.googleapis.com/auth/youtube.upload"];

export const youtubeProvider: PlatformProvider = {
  platform: "youtube",
  requiredScopes: scopes,
  isConfigured() {
    return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  },
  getAuthUrl(state: string) {
    return buildUrl("https://accounts.google.com/o/oauth2/v2/auth", {
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: env.YOUTUBE_REDIRECT_URI || redirectUri("youtube"),
      scope: scopes.join(" "),
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      state,
    });
  },
  async exchangeCode(code: string): Promise<OAuthTokenResult> {
    if (env.SOCIAL_INTEGRATIONS_MODE === "mock") return buildMockToken("youtube", scopes);

    const token = await postForm<GoogleTokenResponse>("https://oauth2.googleapis.com/token", {
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: env.YOUTUBE_REDIRECT_URI || redirectUri("youtube"),
    });

    return {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_type: token.token_type || "Bearer",
      expires_in: token.expires_in,
      scopes: token.scope?.split(" ") || scopes,
      account_name: "YouTube conectado",
    };
  },
  async publish(_account: PlatformAccount, payload: PublishPayload): Promise<PublishResult> {
    return buildMockPublish("youtube", payload);
  },
};
