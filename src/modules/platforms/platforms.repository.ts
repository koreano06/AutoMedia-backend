import { db } from "../../shared/store/in-memory-db.js";

export const platformsRepository = {
  listAccounts() {
    return db.platformAccounts;
  },

  updateStatus(platform: string, status: "connected" | "expired" | "error" | "disconnected") {
    const account = db.platformAccounts.find((item) => item.platform === platform);
    if (!account) return null;
    account.status = status;
    account.last_sync_at = new Date().toISOString();
    return account;
  },
};
