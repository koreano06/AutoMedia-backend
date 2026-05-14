import { z } from "zod";

export const postPayloadSchema = z.object({
  product_id: z.string().optional(),
  media_asset_id: z.string().optional(),
  product_name: z.string().optional(),
  platform: z.string().optional(),
  caption: z.string().optional(),
  status: z.string().optional(),
  scheduled_at: z.string().optional(),
  published_at: z.string().optional(),
  external_post_id: z.string().optional(),
  external_url: z.string().optional(),
  error_message: z.string().optional(),
  engagement_likes: z.number().optional(),
  engagement_comments: z.number().optional(),
  engagement_shares: z.number().optional(),
  engagement_reach: z.number().optional(),
  thumbnail_url: z.string().optional(),
  campaign_name: z.string().optional(),
});

export const schedulePostSchema = z.object({
  media_asset_id: z.string().min(1),
  platforms: z.array(z.string()).min(1),
  caption: z.string().default(""),
  schedule_mode: z.enum(["now", "scheduled", "random_window"]).default("random_window"),
  scheduled_at: z.string().optional(),
});
