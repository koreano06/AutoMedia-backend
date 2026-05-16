import { db } from "../../shared/store/in-memory-db.js";
import type { PlatformAccount } from "../../shared/types/domain.js";
import { prisma } from "../../database/prisma.js";

const seedPlatforms = ["instagram", "tiktok", "facebook", "youtube", "shopee", "mercadolivre"];
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

function toDomain(account: {
  id: string;
  platform: string;
  accountName: string;
  accountId: string | null;
  status: string;
  scopes: string[];
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
  lastSyncAt: Date | null;
  errorMessage: string | null;
  metadata: unknown;
}): PlatformAccount {
  return {
    id: account.id,
    platform: account.platform,
    account_name: account.accountName,
    account_id: account.accountId || undefined,
    status: account.status as PlatformAccount["status"],
    scopes: account.scopes,
    access_token: account.accessToken || undefined,
    refresh_token: account.refreshToken || undefined,
    expires_at: account.expiresAt?.toISOString(),
    last_sync_at: account.lastSyncAt?.toISOString(),
    error_message: account.errorMessage || undefined,
    metadata: (account.metadata && typeof account.metadata === "object" ? account.metadata : undefined) as PlatformAccount["metadata"],
  };
}

function toPrismaPayload(payload: Partial<PlatformAccount>) {
  const has = (key: keyof PlatformAccount) => Object.prototype.hasOwnProperty.call(payload, key);

  return {
    accountName: has("account_name") ? payload.account_name : undefined,
    accountId: has("account_id") ? payload.account_id || null : undefined,
    status: has("status") ? payload.status : undefined,
    scopes: has("scopes") ? payload.scopes || [] : undefined,
    accessToken: has("access_token") ? payload.access_token || null : undefined,
    refreshToken: has("refresh_token") ? payload.refresh_token || null : undefined,
    expiresAt: has("expires_at") ? (payload.expires_at ? new Date(payload.expires_at) : null) : undefined,
    lastSyncAt: has("last_sync_at") ? (payload.last_sync_at ? new Date(payload.last_sync_at) : null) : undefined,
    errorMessage: has("error_message") ? payload.error_message || null : undefined,
    metadata: has("metadata") ? payload.metadata || undefined : undefined,
  };
}

async function seedDatabaseAccounts() {
  await Promise.all(seedPlatforms.map((platform) =>
    prisma.platformAccount.upsert({
      where: { platform },
      update: {},
      create: {
        platform,
        accountName: platform === "mercadolivre" ? "Mercado Livre" : platform.charAt(0).toUpperCase() + platform.slice(1),
        status: "disconnected",
      },
    }),
  ));
}

async function withDatabase<T>(operation: () => Promise<T>, fallback: () => T) {
  if (!hasDatabaseUrl) return fallback();

  try {
    return await operation();
  } catch {
    return fallback();
  }
}

export const platformsRepository = {
  async listAccounts() {
    return withDatabase(async () => {
      await seedDatabaseAccounts();
      const accounts = await prisma.platformAccount.findMany({ orderBy: { platform: "asc" } });
      return accounts.map(toDomain);
    }, () => db.platformAccounts);
  },

  async findByPlatform(platform: string) {
    return withDatabase(async () => {
      await seedDatabaseAccounts();
      const account = await prisma.platformAccount.findUnique({ where: { platform } });
      return account ? toDomain(account) : null;
    }, () => db.platformAccounts.find((item) => item.platform === platform) || null);
  },

  async updateStatus(platform: string, status: "connected" | "expired" | "error" | "disconnected") {
    const account = db.platformAccounts.find((item) => item.platform === platform);
    if (!account) return null;
    account.status = status;
    account.last_sync_at = new Date().toISOString();

    return withDatabase(async () => {
      const updated = await prisma.platformAccount.update({
        where: { platform },
        data: { status, lastSyncAt: new Date() },
      });
      return toDomain(updated);
    }, () => account);
  },

  async updateAccount(platform: string, payload: Partial<PlatformAccount>) {
    const account = db.platformAccounts.find((item) => item.platform === platform);
    if (!account) return null;

    Object.assign(account, payload, { last_sync_at: new Date().toISOString() });

    return withDatabase(async () => {
      const updated = await prisma.platformAccount.update({
        where: { platform },
        data: {
          ...toPrismaPayload(payload),
          lastSyncAt: new Date(),
        },
      });
      return toDomain(updated);
    }, () => account);
  },
};
