import type { PlatformAccount } from "../../shared/types/domain.js";
import { prisma } from "../../database/prisma.js";
import { decryptSecret, encryptSecret } from "../../shared/utils/crypto.js";
import { requireWorkspaceId } from "../../shared/utils/workspace.js";

const seedPlatforms = ["instagram", "tiktok", "facebook", "youtube", "shopee", "mercadolivre"];

function toDomain(account: {
  id: string;
  platform: string;
  accountName: string;
  accountId: string | null;
  workspaceId: string | null;
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
    workspace_id: account.workspaceId || undefined,
    platform: account.platform,
    account_name: account.accountName,
    account_id: account.accountId || undefined,
    status: account.status as PlatformAccount["status"],
    scopes: account.scopes,
    access_token: decryptSecret(account.accessToken),
    refresh_token: decryptSecret(account.refreshToken),
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
    accessToken: has("access_token") ? encryptSecret(payload.access_token || null) : undefined,
    refreshToken: has("refresh_token") ? encryptSecret(payload.refresh_token || null) : undefined,
    expiresAt: has("expires_at") ? (payload.expires_at ? new Date(payload.expires_at) : null) : undefined,
    lastSyncAt: has("last_sync_at") ? (payload.last_sync_at ? new Date(payload.last_sync_at) : null) : undefined,
    errorMessage: has("error_message") ? payload.error_message || null : undefined,
    metadata: has("metadata") ? payload.metadata || undefined : undefined,
  };
}

async function seedDatabaseAccounts(workspaceId: string) {
  await prisma.workspace.upsert({
    where: { id: workspaceId },
    update: {},
    create: { id: workspaceId, name: "AutoMedia", slug: workspaceId === "workspace_automedia" ? "automedia" : workspaceId },
  });

  await Promise.all(seedPlatforms.map((platform) =>
    prisma.platformAccount.upsert({
      where: { workspaceId_platform: { workspaceId, platform } },
      update: {},
      create: {
        workspaceId,
        platform,
        accountName: platform === "mercadolivre" ? "Mercado Livre" : platform.charAt(0).toUpperCase() + platform.slice(1),
        status: "disconnected",
      },
    }),
  ));
}

export const platformsRepository = {
  async listAccounts(workspaceId?: string) {
    const resolvedWorkspaceId = requireWorkspaceId(workspaceId);
    await seedDatabaseAccounts(resolvedWorkspaceId);
    const accounts = await prisma.platformAccount.findMany({
      where: { workspaceId: resolvedWorkspaceId },
      orderBy: { platform: "asc" },
    });
    return accounts.map(toDomain);
  },

  async findByPlatform(platform: string, workspaceId?: string) {
    const resolvedWorkspaceId = requireWorkspaceId(workspaceId);
    await seedDatabaseAccounts(resolvedWorkspaceId);
    const account = await prisma.platformAccount.findUnique({ where: { workspaceId_platform: { workspaceId: resolvedWorkspaceId, platform } } });
    return account ? toDomain(account) : null;
  },

  async updateStatus(platform: string, status: "connected" | "expired" | "error" | "disconnected", workspaceId?: string) {
    const resolvedWorkspaceId = requireWorkspaceId(workspaceId);
    const updated = await prisma.platformAccount.update({
      where: { workspaceId_platform: { workspaceId: resolvedWorkspaceId, platform } },
      data: { status, lastSyncAt: new Date() },
    });
    return toDomain(updated);
  },

  async updateAccount(platform: string, payload: Partial<PlatformAccount>) {
    const data = toPrismaPayload(payload);
    const workspaceId = requireWorkspaceId(payload.workspace_id);
    const updated = await prisma.platformAccount.upsert({
      where: { workspaceId_platform: { workspaceId, platform } },
      update: {
        ...data,
        lastSyncAt: new Date(),
      },
      create: {
        ...data,
        platform,
        workspaceId,
        accountName: payload.account_name || (platform === "mercadolivre" ? "Mercado Livre" : platform.charAt(0).toUpperCase() + platform.slice(1)),
        status: payload.status || "disconnected",
        lastSyncAt: new Date(),
      },
    });
    return toDomain(updated);
  },
};
