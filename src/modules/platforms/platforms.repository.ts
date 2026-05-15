import { db } from "../../shared/store/in-memory-db.js";
import type { PlatformAccount } from "../../shared/types/domain.js";

export const platformsRepository = {
  listAccounts() {
    return db.platformAccounts;
  },

  findByPlatform(platform: string) {
    return db.platformAccounts.find((item) => item.platform === platform) || null;
  },

  updateStatus(platform: string, status: "connected" | "expired" | "error" | "disconnected") {
    const account = db.platformAccounts.find((item) => item.platform === platform);
    if (!account) return null;
    account.status = status;
    account.last_sync_at = new Date().toISOString();
    return account;
  },

  updateAccount(platform: string, payload: Partial<PlatformAccount>) {
    const account = db.platformAccounts.find((item) => item.platform === platform);
    if (!account) return null;

    Object.assign(account, payload, { last_sync_at: new Date().toISOString() });
    return account;
  },
};
