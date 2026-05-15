import { createMetaProvider } from "./meta.provider.js";
import { mercadoLivreProvider } from "./mercadolivre.provider.js";
import type { PlatformProvider } from "./platform-provider.types.js";
import { shopeeProvider } from "./shopee.provider.js";
import { tiktokProvider } from "./tiktok.provider.js";
import { youtubeProvider } from "./youtube.provider.js";

const providers: Record<string, PlatformProvider> = {
  instagram: createMetaProvider("instagram"),
  facebook: createMetaProvider("facebook"),
  tiktok: tiktokProvider,
  youtube: youtubeProvider,
  shopee: shopeeProvider,
  mercadolivre: mercadoLivreProvider,
};

export function getPlatformProvider(platform: string) {
  return providers[platform] || null;
}

export function listPlatformProviders() {
  return Object.values(providers);
}
