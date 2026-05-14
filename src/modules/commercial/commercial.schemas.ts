import { z } from "zod";

export const campaignSchema = z.object({
  name: z.string().min(1),
  product_ids: z.array(z.string()).default([]),
  platforms: z.array(z.string()).default([]),
});
