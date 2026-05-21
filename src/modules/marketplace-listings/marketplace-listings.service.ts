import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";
import { nowIso } from "../../shared/utils/dates.js";
import { platformsRepository } from "../platforms/platforms.repository.js";
import { productsRepository } from "../products/products.repository.js";
import { marketplaceListingsRepository } from "./marketplace-listings.repository.js";
import type { MarketplaceListing, Product } from "../../shared/types/domain.js";

const marketplaces = ["shopee", "mercadolivre"];

function ensureMarketplace(platform?: string) {
  if (!platform || !marketplaces.includes(platform)) {
    throw new AppError("Marketplace não suportado para anúncios", 400, "MARKETPLACE_NOT_SUPPORTED");
  }
}

function accountCanPublish(account: Awaited<ReturnType<typeof platformsRepository.findByPlatform>>) {
  if (!account || account.status !== "connected" || !account.access_token) return false;
  if (account.expires_at && new Date(account.expires_at).getTime() <= Date.now()) return false;
  return true;
}

function listingPayloadFromProduct(product: Product, payload: Partial<MarketplaceListing>) {
  return {
    product_id: product.id,
    platform: payload.platform,
    title: payload.title || product.name,
    description: payload.description || product.description,
    price: payload.price ?? product.price,
    stock_quantity: payload.stock_quantity ?? product.stock_quantity ?? 0,
    currency: payload.currency || product.currency || "BRL",
    sku: payload.sku || product.sku || product.internal_code,
    category_name: payload.category_name || product.category,
    category_id: payload.category_id,
    attributes: payload.attributes || product.attributes,
    logistics: payload.logistics,
    status: payload.status || "draft",
    metadata: {
      ...(payload.metadata || {}),
      source: "automedia_marketplace_ads",
    },
  } as Partial<MarketplaceListing>;
}

export const marketplaceListingsService = {
  list(order = "-created_at", limit?: number) {
    return marketplaceListingsRepository.list(order, limit);
  },

  async create(payload: Partial<MarketplaceListing>) {
    ensureMarketplace(payload.platform);
    if (!payload.product_id) throw new AppError("Produto obrigatório", 400, "PRODUCT_REQUIRED");

    const product = await productsRepository.findById(payload.product_id);
    if (!product) throw new AppError("Produto não encontrado", 404, "PRODUCT_NOT_FOUND");

    return marketplaceListingsRepository.create(listingPayloadFromProduct(product, payload));
  },

  update(id: string, payload: Partial<MarketplaceListing>) {
    return marketplaceListingsRepository.update(id, payload);
  },

  delete(id: string) {
    return marketplaceListingsRepository.delete(id);
  },

  async publishNow(id: string) {
    const listing = await marketplaceListingsRepository.findById(id);
    if (!listing) throw new AppError("Anúncio não encontrado", 404, "MARKETPLACE_LISTING_NOT_FOUND");
    ensureMarketplace(listing.platform);

    const account = await platformsRepository.findByPlatform(String(listing.platform));
    if (!accountCanPublish(account)) {
      const failed = await marketplaceListingsRepository.update(id, {
        status: "failed",
        error_message: "Conecte e sincronize a conta do marketplace antes de publicar.",
        last_sync_at: nowIso(),
      });
      throw new AppError(failed.error_message || "Marketplace não conectado", 409, "MARKETPLACE_ACCOUNT_NOT_READY");
    }

    if (env.SOCIAL_INTEGRATIONS_MODE === "live") {
      const failed = await marketplaceListingsRepository.update(id, {
        status: "failed",
        error_message: "Publicação real de anúncio exige mapeamento oficial de categoria, atributos, imagens e logística do marketplace.",
        last_sync_at: nowIso(),
      });
      throw new AppError(failed.error_message || "Publicação real ainda não configurada", 422, "MARKETPLACE_LISTING_API_REQUIRED");
    }

    const now = nowIso();
    const externalId = `mock_${listing.platform}_listing_${Date.now()}`;

    return marketplaceListingsRepository.update(id, {
      status: "published",
      external_listing_id: externalId,
      external_url: `https://example.com/${listing.platform}/listing/${externalId}`,
      error_message: "",
      published_at: now,
      last_sync_at: now,
      metadata: {
        ...(listing.metadata || {}),
        mode: "mock",
        published_by: "automedia",
      },
    });
  },
};
