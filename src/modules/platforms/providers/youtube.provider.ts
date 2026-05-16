import { env } from "../../../config/env.js";
import type { PlatformAccount } from "../../../shared/types/domain.js";
import type { OAuthTokenResult, PlatformProvider, PublishPayload, PublishResult } from "./platform-provider.types.js";
import { buildMockPublish, buildMockToken, buildUrl, captionFor, getBearerToken, postForm, redirectUri, requirePublicMediaUrl } from "./provider-utils.js";

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
};

const scopes = ["https://www.googleapis.com/auth/youtube.upload"];
const maxServerlessUploadBytes = 50 * 1024 * 1024;

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
  async publish(account: PlatformAccount, payload: PublishPayload): Promise<PublishResult> {
    if (env.SOCIAL_INTEGRATIONS_MODE === "mock") return buildMockPublish("youtube", payload);

    const token = getBearerToken(account);
    const mediaUrl = requirePublicMediaUrl(payload, "YouTube");
    const mediaResponse = await fetch(mediaUrl);
    if (!mediaResponse.ok) throw new Error(`Nao foi possivel baixar a midia para YouTube: ${mediaResponse.status}`);

    const contentType = payload.mime_type || mediaResponse.headers.get("content-type") || "video/mp4";
    if (!contentType.startsWith("video/") && contentType !== "application/octet-stream") {
      throw new Error("YouTube aceita apenas videos para publicacao automatica.");
    }

    const contentLength = Number(mediaResponse.headers.get("content-length") || 0);
    if (contentLength > maxServerlessUploadBytes) {
      throw new Error("Video grande demais para upload direto em serverless. Envie por worker dedicado ou storage/queue.");
    }

    const videoBuffer = Buffer.from(await mediaResponse.arrayBuffer());
    if (videoBuffer.byteLength > maxServerlessUploadBytes) {
      throw new Error("Video grande demais para upload direto em serverless. Envie por worker dedicado ou storage/queue.");
    }

    const metadata = {
      snippet: {
        title: (payload.title || payload.product_name || "Video AutoMedia").slice(0, 100),
        description: captionFor(payload, 5000),
        categoryId: "22",
      },
      status: {
        privacyStatus: "private",
        selfDeclaredMadeForKids: false,
      },
    };

    const initResponse = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(videoBuffer.byteLength),
        "X-Upload-Content-Type": contentType,
      },
      body: JSON.stringify(metadata),
    });

    if (!initResponse.ok) {
      const error = await initResponse.text();
      throw new Error(`Falha ao iniciar upload YouTube: ${error}`);
    }

    const uploadUrl = initResponse.headers.get("location");
    if (!uploadUrl) throw new Error("YouTube nao retornou URL de upload resumivel.");

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Length": String(videoBuffer.byteLength),
        "Content-Type": contentType,
      },
      body: videoBuffer,
    });

    const published = await uploadResponse.json().catch(() => ({})) as { id?: string };
    if (!uploadResponse.ok) {
      throw new Error(`Falha no upload YouTube: ${JSON.stringify(published)}`);
    }

    return {
      external_post_id: published.id || `youtube_${Date.now()}`,
      external_url: published.id ? `https://www.youtube.com/watch?v=${published.id}` : undefined,
      status: "published",
      message: "Video enviado para o YouTube Data API como privado.",
      raw: published,
    };
  },
};
