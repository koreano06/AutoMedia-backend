import { z } from "zod";

const briefingSchema = z.object({
  targetAudience: z.string().optional(),
  tone: z.string().optional(),
  objective: z.string().optional(),
  promise: z.string().optional(),
  cta: z.string().optional(),
  restrictions: z.string().optional(),
  painPoint: z.string().optional(),
  objection: z.string().optional(),
  extra: z.string().optional(),
}).partial().default({});

export const generateVideoSchema = z.object({
  product_id: z.string().min(1),
  media_asset_ids: z.array(z.string()).default([]),
  style: z.string().default("product"),
  template: z.string().optional(),
  format: z.string().optional(),
  ratio: z.string().optional(),
  duration: z.string().default("30s"),
  briefing: z.string().optional(),
  briefing_fields: briefingSchema.optional(),
  visual_prompt: z.string().optional(),
  script: z.string().optional(),
  rhythm: z.string().optional(),
  audio: z.string().optional(),
  platform: z.string().optional(),
  platforms: z.array(z.string()).optional(),
});

export type GenerateVideoInput = z.infer<typeof generateVideoSchema>;
