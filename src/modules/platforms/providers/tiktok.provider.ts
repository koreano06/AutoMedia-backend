import { env } from "../../../config/env.js";
import type { PlatformAccount } from "../../../shared/types/domain.js";
import type { OAuthTokenResult, PlatformProvider, PublishPayload, PublishResult } from "./platform-provider.types.js";
import { buildMockPublish, buildMockToken, buildUrl, captionFor, getBearerToken, postForm, postJson, redirectUri, requirePublicMediaUrl } from "./provider-utils.js";

type TikTokTokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  open_id?: string;
};

type TikTokPublishResponse = {
  data?: {
    publish_id?: string;
  };
  error?: {
    code?: string;
    message?: string;
    log_id?: string;
  };
};

const scopes = ["user.info.basic", "video.publish", "video.upload"];

export const tiktokProvider: PlatformProvider = {
  platform: "tiktok",
  requiredScopes: scopes,
  isConfigured() {
    return Boolean(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET);
  },
  getAuthUrl(state: string) {
    return buildUrl("https://www.tiktok.com/v2/auth/authorize/", {
      client_key: env.TIKTOK_CLIENT_KEY,
      redirect_uri: env.TIKTOK_REDIRECT_URI || redirectUri("tiktok"),
      scope: scopes.join(","),
      response_type: "code",
      state,
    });
  },
  async exchangeCode(code: string): Promise<OAuthTokenResult> {
    if (env.SOCIAL_INTEGRATIONS_MODE === "mock") return buildMockToken("tiktok", scopes);

    const token = await postForm<TikTokTokenResponse>("https://open.tiktokapis.com/v2/oauth/token/", {
      client_key: env.TIKTOK_CLIENT_KEY,
      client_secret: env.TIKTOK_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: env.TIKTOK_REDIRECT_URI || redirectUri("tiktok"),
    });

    return {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_type: token.token_type || "Bearer",
      expires_in: token.expires_in,
      scopes: token.scope?.split(",") || scopes,
      provider_user_id: token.open_id,
      account_name: "TikTok conectado",
    };
  },
  async publish(account: PlatformAccount, payload: PublishPayload): Promise<PublishResult> {
    if (env.SOCIAL_INTEGRATIONS_MODE === "mock") return buildMockPublish("tiktok", payload);

    const mediaUrl = requirePublicMediaUrl(payload, "TikTok");
    const token = getBearerToken(account);
    const response = await postJson<TikTokPublishResponse>("https://open.tiktokapis.com/v2/post/publish/video/init/", {
      post_info: {
        title: captionFor(payload, 2200),
        privacy_level: "SELF_ONLY",
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        brand_content_toggle: false,
        brand_organic_toggle: true,
        is_aigc: true,
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: mediaUrl,
      },
    }, token);

    if (response.error?.code && response.error.code !== "ok") {
      return {
        external_post_id: response.data?.publish_id || `tiktok_failed_${Date.now()}`,
        status: "failed",
        message: response.error.message || response.error.code,
        raw: response,
      };
    }

    return {
      external_post_id: response.data?.publish_id || `tiktok_${Date.now()}`,
      status: "publishing",
      message: "Envio iniciado no TikTok Content Posting API.",
      raw: response,
    };
  },
};
