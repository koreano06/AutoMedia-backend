import { platformsRepository } from "./platforms.repository.js";
import { AppError } from "../../shared/errors/AppError.js";

export const platformsService = {
  listAccounts() {
    return platformsRepository.listAccounts();
  },

  connect(platform: string) {
    const account = platformsRepository.updateStatus(platform, "connected");
    if (!account) throw new AppError("Plataforma não suportada", 404, "PLATFORM_NOT_FOUND");
    return { account, oauth_url: `/api/platforms/${platform}/oauth/mock` };
  },

  disconnect(platform: string) {
    const account = platformsRepository.updateStatus(platform, "disconnected");
    if (!account) throw new AppError("Plataforma não suportada", 404, "PLATFORM_NOT_FOUND");
    return account;
  },
};
