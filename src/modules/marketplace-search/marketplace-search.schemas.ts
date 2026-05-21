import { z } from "zod";

export const marketplaceSearchQuerySchema = z.object({
  platform: z.enum(["mercadolivre", "shopee"]).default("mercadolivre"),
  query: z.string().min(2),
  limit: z.coerce.number().min(1).max(20).default(8),
});

export type MarketplaceSearchQuery = z.infer<typeof marketplaceSearchQuerySchema>;
