import { z } from "zod";

export const productPayloadSchema = z.object({
  name: z.string().min(1).default("Produto sem nome"),
  input_source: z.enum(["manual", "image_upload", "product_url"]).optional(),
  source_url: z.string().url().optional().or(z.literal("")),
  image_url: z.string().url().optional().or(z.literal("")),
  uploaded_image_url: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  brand: z.string().optional(),
  price: z.union([z.number(), z.string()]).optional(),
  cost_price: z.union([z.number(), z.string()]).optional(),
  margin_percent: z.number().optional(),
  sku: z.string().optional(),
  internal_code: z.string().optional(),
  supplier_name: z.string().optional(),
  supplier_contact: z.string().optional(),
  supplier_lead_time_days: z.number().optional(),
  stock_quantity: z.number().optional(),
  min_stock: z.number().optional(),
  marketplace_origin: z.string().optional(),
  currency: z.string().optional(),
  product_url: z.string().optional(),
  affiliate_url: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  attributes: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  status: z.string().optional(),
});

export const productAnalyzeSchema = z.object({
  product_id: z.string().optional(),
  source_url: z.string().url().optional(),
  image_asset_id: z.string().optional(),
});

export const productQuerySchema = z.object({
  order: z.string().default("-created_at"),
  limit: z.coerce.number().optional(),
});
