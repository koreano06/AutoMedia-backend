import { platformsRepository } from "./platforms.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { env } from "../../config/env.js";
import { nowIso } from "../../shared/utils/dates.js";
import { getPlatformProvider } from "./providers/index.js";
import { ensureConfigured } from "./providers/provider-utils.js";
import type { PlatformAccount } from "../../shared/types/domain.js";
import type { PublishPayload } from "./providers/platform-provider.types.js";

function encodeState(platform: string) {
  return Buffer.from(JSON.stringify({ platform, created_at: Date.now() })).toString("base64url");
}

function expiresAt(expiresIn?: number) {
  if (!expiresIn) return undefined;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

async function persistToken(platform: string, providerScopes: string[], token: {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  scopes?: string[];
  expires_in?: number;
  account_id?: string;
  provider_user_id?: string;
  account_name?: string;
}, metadata: Record<string, string | number | boolean>) {
  return platformsRepository.updateAccount(platform, {
    status: "connected",
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    token_type: token.token_type || "Bearer",
    scopes: token.scopes || providerScopes,
    expires_at: expiresAt(token.expires_in),
    account_id: token.account_id,
    provider_user_id: token.provider_user_id,
    account_name: token.account_name || `${platform} conectado`,
    error_message: undefined,
    metadata,
  });
}

function setupHint(platform: string, configured: boolean) {
  if (env.SOCIAL_INTEGRATIONS_MODE === "mock") return "Modo teste ativo. Use live para OAuth real.";
  if (configured) return "Credenciais configuradas. Pronto para autorizar OAuth.";

  const keys: Record<string, string> = {
    instagram: "META_CLIENT_ID e META_CLIENT_SECRET",
    facebook: "META_CLIENT_ID e META_CLIENT_SECRET",
    tiktok: "TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET",
    youtube: "GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET",
    shopee: "SHOPEE_PARTNER_ID e SHOPEE_PARTNER_KEY",
    mercadolivre: "MERCADOLIVRE_CLIENT_ID e MERCADOLIVRE_CLIENT_SECRET",
  };

  return `Configure ${keys[platform] || "as credenciais oficiais"} no backend.`;
}

function decorateAccount(account: PlatformAccount) {
  const provider = getPlatformProvider(account.platform);
  const configured = provider?.isConfigured() || env.SOCIAL_INTEGRATIONS_MODE === "mock";

  return {
    ...account,
    configured,
    mode: env.SOCIAL_INTEGRATIONS_MODE,
    required_scopes: provider?.requiredScopes || [],
    setup_status: env.SOCIAL_INTEGRATIONS_MODE === "mock" ? "mock" : configured ? "ready" : "missing_credentials",
    setup_hint: setupHint(account.platform, Boolean(configured)),
  };
}

export const platformsService = {
  async listAccounts() {
    const accounts: PlatformAccount[] = await platformsRepository.listAccounts();
    return accounts.map(decorateAccount);
  },

  async connect(platform: string) {
    const account = await platformsRepository.findByPlatform(platform);
    const provider = getPlatformProvider(platform);
    if (!account || !provider) throw new AppError("Plataforma não suportada", 404, "PLATFORM_NOT_FOUND");

    if (env.SOCIAL_INTEGRATIONS_MODE === "mock") {
      const token = {
        access_token: `mock_${platform}_access_${Date.now()}`,
        refresh_token: `mock_${platform}_refresh_${Date.now()}`,
        token_type: "Bearer",
        expires_in: 60 * 60 * 24 * 30,
        scopes: provider.requiredScopes,
      };
      const connected = await platformsRepository.updateAccount(platform, {
        status: "connected",
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        token_type: token.token_type,
        scopes: token.scopes,
        expires_at: expiresAt(token.expires_in),
        account_name: account.account_name,
        metadata: { mode: "mock" },
      });

      return {
        account: decorateAccount(connected),
        oauth_url: `${env.FRONTEND_URL}/integrations?platform=${platform}&connected=1`,
        mode: "mock",
      };
    }

    ensureConfigured(provider);

    return {
      account: decorateAccount(account),
      oauth_url: provider.getAuthUrl(encodeState(platform)),
      mode: "live",
    };
  },

  async getConnectUrl(platform: string) {
    return this.connect(platform);
  },

  async handleCallback(platform: string, query: { code?: string; error?: string; error_description?: string; shop_id?: string }) {
    if (query.error) {
      await platformsRepository.updateAccount(platform, { status: "error", error_message: query.error_description || query.error });
      return { redirect_url: `${env.FRONTEND_URL}/integrations?platform=${platform}&error=${encodeURIComponent(query.error)}` };
    }

    if (!query.code) throw new AppError("Código OAuth ausente", 400, "OAUTH_CODE_MISSING");

    const provider = getPlatformProvider(platform);
    if (!provider) throw new AppError("Plataforma não suportada", 404, "PLATFORM_NOT_FOUND");
    if (env.SOCIAL_INTEGRATIONS_MODE === "live") ensureConfigured(provider);

    const token = await provider.exchangeCode(query.code, { shop_id: query.shop_id });
    const account = await persistToken(platform, provider.requiredScopes, token, { connected_at: nowIso(), mode: env.SOCIAL_INTEGRATIONS_MODE });

    return { account: decorateAccount(account), redirect_url: `${env.FRONTEND_URL}/integrations?platform=${platform}&connected=1` };
  },

  async refresh(platform: string) {
    const account = await platformsRepository.findByPlatform(platform);
    const provider = getPlatformProvider(platform);
    if (!account || !provider) throw new AppError("Plataforma não suportada", 404, "PLATFORM_NOT_FOUND");
    if (!provider.refreshToken) throw new AppError("Refresh token não suportado nesta plataforma", 400, "PLATFORM_REFRESH_UNSUPPORTED");

    const token = await provider.refreshToken(account);
    const refreshed = await persistToken(platform, provider.requiredScopes, token, { refreshed_at: nowIso(), mode: env.SOCIAL_INTEGRATIONS_MODE });
    return decorateAccount(refreshed);
  },

  async syncAccount(platform: string) {
    const account = await platformsRepository.findByPlatform(platform);
    const provider = getPlatformProvider(platform);
    if (!account || !provider) throw new AppError("Plataforma não suportada", 404, "PLATFORM_NOT_FOUND");
    if (!provider.getAccountInfo) throw new AppError("Sincronização não suportada nesta plataforma", 400, "PLATFORM_SYNC_UNSUPPORTED");
    if (account.status !== "connected" || !account.access_token) throw new AppError("Plataforma não conectada", 409, "PLATFORM_NOT_CONNECTED");

    const info = await provider.getAccountInfo(account);
    const infoRecord = info && typeof info === "object" ? info as Record<string, string | number | boolean | undefined> : {};
    const syncedAt = nowIso();
    const metadata: Record<string, string | number | boolean> = {
      ...(account.metadata || {}),
      synced_at: syncedAt,
      mode: env.SOCIAL_INTEGRATIONS_MODE,
    };

    if (infoRecord.status) metadata.external_status = String(infoRecord.status);
    if (infoRecord.region) metadata.region = String(infoRecord.region);

    const updated = await platformsRepository.updateAccount(platform, {
      account_id: infoRecord.shop_id ? String(infoRecord.shop_id) : account.account_id,
      account_name: infoRecord.shop_name ? String(infoRecord.shop_name) : account.account_name,
      last_sync_at: syncedAt,
      metadata,
    });

    return { account: decorateAccount(updated), info };
  },

  async disconnect(platform: string) {
    const account = await platformsRepository.updateAccount(platform, {
      status: "disconnected",
      access_token: undefined,
      refresh_token: undefined,
      expires_at: undefined,
      scopes: undefined,
      error_message: undefined,
      metadata: undefined,
    });
    if (!account) throw new AppError("Plataforma não suportada", 404, "PLATFORM_NOT_FOUND");
    return decorateAccount(account);
  },

  async publish(platform: string, payload: PublishPayload) {
    const account = await platformsRepository.findByPlatform(platform);
    const provider = getPlatformProvider(platform);
    if (!account || !provider) throw new AppError("Plataforma não suportada", 404, "PLATFORM_NOT_FOUND");
    if (account.status !== "connected" || !account.access_token) throw new AppError("Plataforma não conectada", 409, "PLATFORM_NOT_CONNECTED");

    return provider.publish(account, payload);
  },
};
