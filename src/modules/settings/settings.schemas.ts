import { z } from "zod";

export const automationSettingsSchema = z.object({
  auto_reply: z.boolean().optional(),
  auto_schedule: z.boolean().optional(),
  notifications: z.boolean().optional(),
  random_schedule: z.boolean().optional(),
  purchase_keywords: z.array(z.string()).optional(),
  posting_start: z.string().optional(),
  posting_end: z.string().optional(),
  enabled_platforms: z.array(z.string()).optional(),
});
