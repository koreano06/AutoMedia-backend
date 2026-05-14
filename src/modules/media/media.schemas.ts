import { z } from "zod";

export const mediaAssetPayloadSchema = z.object({
  product_id: z.string().optional(),
  product_name: z.string().optional(),
  type: z.string().default("image"),
  title: z.string().optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  source_url: z.string().optional(),
  url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  storage_key: z.string().optional(),
  mime_type: z.string().optional(),
  file_size: z.number().optional(),
  caption: z.string().optional(),
  platforms: z.array(z.string()).optional(),
  quality_score: z.number().optional(),
  duration: z.union([z.number(), z.string()]).optional(),
  review_notes: z.string().optional(),
  rejection_reason: z.string().optional(),
});

export const mediaQuerySchema = z.object({
  order: z.string().default("-created_at"),
  limit: z.coerce.number().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  product_id: z.string().optional(),
});

export const collectMediaSchema = z.object({
  product_id: z.string().min(1),
  query: z.string().optional(),
  sources: z.array(z.string()).default(["web", "youtube", "marketplaces"]),
});
