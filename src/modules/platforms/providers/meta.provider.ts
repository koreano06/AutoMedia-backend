import { env } from "../../../config/env.js";
import type { PlatformAccount } from "../../../shared/types/domain.js";
import type { OAuthTokenResult, PlatformProvider, PublishPayload, PublishResult } from "./platform-provider.types.js";
import {
  buildMockPublish,
  buildMockToken,
  buildUrl,
  captionFor,
  getBearerToken,
  getJson,
  postForm,
  postGraphForm,
  redirectUri,
  requirePublicMediaUrl,
} from "./provider-utils.js";

type MetaTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

type MetaPageResponse = {
  data?: Array<{
    id: string;
    name?: string;
    access_token?: string;
    instagram_business_account?: {
      id: string;
      username?: string;
    };
  }>;
};

type MetaPublishResponse = {
  id?: string;
  post_id?: string;
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

      const pages = await getJson<MetaPageResponse>(
        `https://graph.facebook.com/${env.META_GRAPH_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}`,
        token.access_token,
      );
      const page = pages.data?.find((item) => platform === "facebook" || item.instagram_business_account) || pages.data?.[0];
      const instagramAccount = page?.instagram_business_account;

      return {
        access_token: platform === "facebook" && page?.access_token ? page.access_token : token.access_token,
        token_type: token.token_type || "Bearer",
        expires_in: token.expires_in,
        scopes,
        account_id: platform === "instagram" ? instagramAccount?.id : page?.id,
        provider_user_id: instagramAccount?.id || page?.id,
        account_name: platform === "instagram"
          ? instagramAccount?.username || "Instagram conectado"
          : page?.name || "Facebook conectado",
      };
    },
    async publish(account: PlatformAccount, payload: PublishPayload): Promise<PublishResult> {
      if (env.SOCIAL_INTEGRATIONS_MODE === "mock") return buildMockPublish(platform, payload);

      const accessToken = getBearerToken(account);
      const caption = captionFor(payload, 2200);

      if (platform === "facebook") {
        const pageId = account.account_id;
        if (!pageId) throw new Error("Facebook Page ID ausente na conta conectada");

        if (payload.media_url) {
          const photo = await postGraphForm<MetaPublishResponse>(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/${pageId}/photos`, {
            url: payload.media_url,
            caption,
            published: true,
            access_token: accessToken,
          });

          return {
            external_post_id: photo.post_id || photo.id || `facebook_${Date.now()}`,
            external_url: photo.post_id ? `https://facebook.com/${photo.post_id}` : undefined,
            status: "published",
            message: "Publicado no Facebook pela Graph API.",
            raw: photo,
          };
        }

        const feed = await postGraphForm<MetaPublishResponse>(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/${pageId}/feed`, {
          message: caption,
          access_token: accessToken,
        });

        return {
          external_post_id: feed.id || `facebook_${Date.now()}`,
          external_url: feed.id ? `https://facebook.com/${feed.id}` : undefined,
          status: "published",
          message: "Publicado no Facebook pela Graph API.",
          raw: feed,
        };
      }

      const igUserId = account.account_id || account.provider_user_id;
      if (!igUserId) throw new Error("Instagram Business Account ID ausente na conta conectada");

      const mediaUrl = requirePublicMediaUrl(payload, "Instagram");
      const isVideo = payload.mime_type?.startsWith("video/") || /\.(mp4|mov|webm)(\?|$)/i.test(mediaUrl);
      const container = await postGraphForm<MetaPublishResponse>(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/${igUserId}/media`, {
        caption,
        access_token: accessToken,
        ...(isVideo ? { media_type: "REELS", video_url: mediaUrl } : { image_url: mediaUrl }),
      });

      if (!container.id) throw new Error("Instagram nao retornou creation_id");

      const published = await postGraphForm<MetaPublishResponse>(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/${igUserId}/media_publish`, {
        creation_id: container.id,
        access_token: accessToken,
      });

      return {
        external_post_id: published.id || container.id,
        external_url: published.id ? `https://instagram.com/p/${published.id}` : undefined,
        status: "published",
        message: "Publicado no Instagram pela Graph API.",
        raw: { container, published },
      };
    },
  };
}
