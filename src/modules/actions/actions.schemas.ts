import { z } from "zod";
import { mediaAssetPayloadSchema } from "../media/media.schemas.js";
import { productAnalyzeSchema, productPayloadSchema } from "../products/products.schemas.js";
import { publishDuePostsSchema, postPayloadSchema } from "../posts/posts.schemas.js";
import { generateVideoSchema } from "../videos/videos.schemas.js";
import { autoReplySchema, commentPayloadSchema } from "../comments/comments.schemas.js";
import { publishPayloadSchema } from "../platforms/platforms.schemas.js";

export const idBodySchema = z.object({
  id: z.string().min(1),
});

export const productAnalyzeActionSchema = productAnalyzeSchema;

export const productUpdateActionSchema = productPayloadSchema.partial().extend({
  id: z.string().min(1),
});

export const productDeleteActionSchema = idBodySchema;

export const mediaCollectActionSchema = z.object({
  product_id: z.string().min(1),
  query: z.string().optional(),
  sources: z.array(z.string().min(1)).default(["web", "youtube", "marketplaces"]),
});

export const mediaUpdateActionSchema = mediaAssetPayloadSchema.partial().extend({
  id: z.string().min(1),
});

export const videoGenerateActionSchema = generateVideoSchema;

export const productImageUploadActionSchema = z.object({
  product_id: z.string().min(1),
  product_name: z.string().optional(),
  title: z.string().max(160).optional(),
  url: z.string().min(1),
  thumbnail_url: z.string().optional(),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]).default("image/png"),
  file_size: z.coerce.number().int().positive().max(8 * 1024 * 1024).optional(),
}).refine((payload) => /^https?:\/\//i.test(payload.url) || payload.url.startsWith("data:image/"), {
  path: ["url"],
  message: "Informe uma URL de imagem http(s) ou data:image válida",
});

export const commentAutoReplyActionSchema = autoReplySchema;

export const commentUpdateActionSchema = commentPayloadSchema.partial().extend({
  id: z.string().min(1),
});

export const platformActionSchema = z.object({
  platform: z.string().min(1),
});

export const platformPublishActionSchema = publishPayloadSchema.extend({
  platform: z.string().min(1),
  mime_type: z.string().optional(),
});

export const postPublishNowActionSchema = idBodySchema;
export const postPublishDueActionSchema = publishDuePostsSchema;

export const postUpdateActionSchema = postPayloadSchema.partial().extend({
  id: z.string().min(1),
});

export const postDeleteActionSchema = idBodySchema;
