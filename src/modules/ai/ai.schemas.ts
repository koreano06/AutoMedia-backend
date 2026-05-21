import { z } from "zod";

export const generateTextSchema = z.object({
  prompt: z.string().min(1),
});

export const generateImageSchema = z.object({
  prompt: z.string().min(10),
  product_id: z.string().optional(),
  product_name: z.string().optional(),
  title: z.string().optional(),
  platform: z.string().optional(),
  format: z.string().optional(),
  size: z.enum(["1024x1024", "1024x1536", "1536x1024"]).default("1024x1536"),
});

export type GenerateImageInput = z.infer<typeof generateImageSchema>;
