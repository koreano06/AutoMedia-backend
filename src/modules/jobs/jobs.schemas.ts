import { z } from "zod";

export const createJobSchema = z.object({
  type: z.enum(["product_analysis", "media_collection", "video_generation", "post_publishing", "comment_reply"]),
  title: z.string().min(1),
  product_id: z.string().optional(),
  media_asset_id: z.string().optional(),
  post_id: z.string().optional(),
});

export const updateJobSchema = z.object({
  status: z.enum(["queued", "processing", "completed", "failed", "cancelled"]).optional(),
  progress: z.number().min(0).max(100).optional(),
  result_url: z.string().optional(),
  error_message: z.string().optional(),
});
