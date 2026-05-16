import type { PlatformAccount } from "../../../shared/types/domain.js";

export type OAuthTokenResult = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scopes?: string[];
  account_id?: string;
  provider_user_id?: string;
  account_name?: string;
};

export type PublishPayload = {
  post_id?: string;
  media_asset_id?: string;
  product_name?: string;
  title?: string;
  caption: string;
  media_url?: string;
  mime_type?: string;
  thumbnail_url?: string;
  scheduled_at?: string;
};

export type PublishResult = {
  external_post_id: string;
  external_url?: string;
  status: "published" | "publishing" | "scheduled" | "failed";
  message: string;
  raw?: unknown;
};

export type PlatformProvider = {
  platform: string;
  requiredScopes: string[];
  isConfigured(): boolean;
  getAuthUrl(state: string): string;
  exchangeCode(code: string, extra?: Record<string, string | undefined>): Promise<OAuthTokenResult>;
  publish(account: PlatformAccount, payload: PublishPayload): Promise<PublishResult>;
};
