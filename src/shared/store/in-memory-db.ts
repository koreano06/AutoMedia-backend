import type { AutomationSettings, Comment, Job, MediaAsset, PlatformAccount, Post, Product } from "../types/domain.js";

export type CollectionName = "products" | "mediaAssets" | "posts" | "comments" | "jobs" | "platformAccounts";

type Database = {
  products: Product[];
  mediaAssets: MediaAsset[];
  posts: Post[];
  comments: Comment[];
  jobs: Job[];
  platformAccounts: PlatformAccount[];
  settings: AutomationSettings;
};

export const db: Database = {
  products: [],
  mediaAssets: [],
  posts: [],
  comments: [],
  jobs: [],
  platformAccounts: [
    { id: "platform_instagram", platform: "instagram", account_name: "Instagram", status: "disconnected" },
    { id: "platform_tiktok", platform: "tiktok", account_name: "TikTok", status: "disconnected" },
    { id: "platform_facebook", platform: "facebook", account_name: "Facebook", status: "disconnected" },
    { id: "platform_youtube", platform: "youtube", account_name: "YouTube", status: "disconnected" },
    { id: "platform_shopee", platform: "shopee", account_name: "Shopee", status: "disconnected" },
    { id: "platform_mercadolivre", platform: "mercadolivre", account_name: "Mercado Livre", status: "disconnected" },
  ],
  settings: {
    id: "automation_settings",
    auto_reply: true,
    auto_schedule: true,
    notifications: true,
    random_schedule: true,
    purchase_keywords: ["eu quero", "quanto custa", "como comprar", "onde comprar", "link do produto"],
    posting_start: "08:00",
    posting_end: "22:00",
    enabled_platforms: ["instagram", "tiktok", "facebook", "youtube", "shopee", "mercadolivre"],
  },
};

export function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function sortByDate<T extends { created_at?: string; updated_at?: string; published_at?: string; scheduled_at?: string }>(items: T[], order = "-created_at") {
  const desc = order.startsWith("-");
  const field = order.replace("-", "") as keyof T;

  return [...items].sort((first, second) => {
    const firstValue = String(first[field] || first.created_at || first.updated_at || "");
    const secondValue = String(second[field] || second.created_at || second.updated_at || "");
    return desc ? secondValue.localeCompare(firstValue) : firstValue.localeCompare(secondValue);
  });
}

export function applyLimit<T>(items: T[], limit?: number) {
  return typeof limit === "number" ? items.slice(0, limit) : items;
}

export function matchesFilter<T extends Record<string, unknown>>(item: T, filter: Partial<T>) {
  return Object.entries(filter).every(([key, value]) => value === undefined || item[key] === value);
}
