import { z } from "zod";

export const platformParamSchema = z.object({ platform: z.string().min(1) });

export const oauthCallbackSchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
  shop_id: z.string().optional(),
});

export const publishPayloadSchema = z.object({
  post_id: z.string().optional(),
  media_asset_id: z.string().optional(),
  product_name: z.string().optional(),
  caption: z.string().default(""),
  media_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  scheduled_at: z.string().optional(),
});
