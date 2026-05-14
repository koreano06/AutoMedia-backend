import { z } from "zod";

export const reportsQuerySchema = z.object({
  period: z.string().optional(),
  platform: z.string().optional(),
});
