import { z } from "zod";

export const commentPayloadSchema = z.object({
  post_id: z.string().optional(),
  external_comment_id: z.string().optional(),
  author: z.string().optional(),
  content: z.string().default(""),
  platform: z.string().optional(),
  is_purchase_intent: z.boolean().optional(),
  auto_replied: z.boolean().optional(),
  reply_content: z.string().optional(),
  detected_at: z.string().optional(),
});

export const autoReplySchema = z.object({
  comment_id: z.string().min(1),
  product_id: z.string().optional(),
  reply_template: z.string().default("Aqui está o link: {{product_url}}"),
});
