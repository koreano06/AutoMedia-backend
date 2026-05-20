import { z } from "zod";

const marketplacePlatformSchema = z.enum(["shopee", "mercadolivre"]);

export const marketplaceListingPayloadSchema = z.object({
  product_id: z.string().min(1),
  platform: marketplacePlatformSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  price: z.union([z.number(), z.string()]).optional(),
  stock_quantity: z.number().int().nonnegative().optional(),
  currency: z.string().default("BRL").optional(),
  sku: z.string().optional(),
  category_id: z.string().optional(),
  category_name: z.string().optional(),
  attributes: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  logistics: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  status: z.string().optional(),
  external_listing_id: z.string().optional(),
  external_url: z.string().optional(),
  error_message: z.string().optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const marketplaceListingUpdateSchema = marketplaceListingPayloadSchema.partial().omit({ product_id: true, platform: true });
