import { z } from "zod";

export const generateVideoSchema = z.object({
  product_id: z.string().min(1),
  media_asset_ids: z.array(z.string()).default([]),
  style: z.string().default("product"),
  duration: z.string().default("30s"),
  briefing: z.string().optional(),
  platform: z.string().optional(),
});
