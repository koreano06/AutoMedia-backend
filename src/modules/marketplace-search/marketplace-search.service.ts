import { AppError } from "../../shared/errors/AppError.js";
import type { MarketplaceSearchQuery } from "./marketplace-search.schemas.js";

type MercadoLivreSearchResponse = {
  results?: Array<{
    id: string;
    title: string;
    price?: number;
    currency_id?: string;
    permalink?: string;
    thumbnail?: string;
    pictures?: Array<{ url?: string }>;
    category_id?: string;
    condition?: string;
    seller?: { id?: number; nickname?: string };
  }>;
};

export type MarketplaceSearchItem = {
  id: string;
  platform: "mercadolivre" | "shopee";
  title: string;
  price?: number;
  currency?: string;
  url?: string;
  image_url?: string;
  category_id?: string;
  seller_name?: string;
  description?: string;
};

function buildUrl(base: string, params: Record<string, string | number | undefined>) {
  const url = new URL(base);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function searchMercadoLivre(query: MarketplaceSearchQuery) {
  const url = buildUrl("https://api.mercadolibre.com/sites/MLB/search", {
    q: query.query,
    limit: query.limit,
  });
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "AutoMedia/1.0 marketplace-content-search",
    },
  });
  const payload = await response.json().catch(() => ({})) as MercadoLivreSearchResponse & { message?: string };

  if (!response.ok) {
    if (response.status === 403) {
      return {
        platform: query.platform,
        query: query.query,
        items: [] as MarketplaceSearchItem[],
        source_status: "blocked_by_provider",
        message: "O Mercado Livre bloqueou a busca pública neste momento. Tente novamente depois ou importe o anúncio pelo link/print.",
      };
    }

    throw new AppError(payload.message || "Falha ao pesquisar no Mercado Livre", response.status, "MERCADOLIVRE_SEARCH_ERROR");
  }

  const items: MarketplaceSearchItem[] = (payload.results || []).map((item) => ({
    id: item.id,
    platform: "mercadolivre",
    title: item.title,
    price: item.price,
    currency: item.currency_id,
    url: item.permalink,
    image_url: item.pictures?.[0]?.url || item.thumbnail,
    category_id: item.category_id,
    seller_name: item.seller?.nickname || (item.seller?.id ? `Vendedor ${item.seller.id}` : undefined),
    description: `${item.title}${item.condition ? ` - condição: ${item.condition}` : ""}`,
  }));

  return {
    platform: query.platform,
    query: query.query,
    items,
    source_status: "live",
  };
}

function searchShopee(query: MarketplaceSearchQuery) {
  return {
    platform: query.platform,
    query: query.query,
    items: [] as MarketplaceSearchItem[],
    source_status: "manual_link_required",
    message: "A Shopee Open API oficial não oferece busca pública ampla de anúncios para qualquer loja. Use link/print do anúncio ou uma conta/parceria Shopee autorizada.",
  };
}

export const marketplaceSearchService = {
  search(query: MarketplaceSearchQuery) {
    if (query.platform === "mercadolivre") return searchMercadoLivre(query);
    return searchShopee(query);
  },
};
