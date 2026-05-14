import { z } from "zod";

export const approveMediaSchema = z.object({
  media_asset_id: z.string().min(1),
  platforms: z.array(z.string()).min(1),
  caption: z.string().default(""),
});

export const rejectMediaSchema = z.object({
  media_asset_id: z.string().min(1),
  rejection_reason: z.string().optional(),
  review_notes: z.string().optional(),
});
