import type { z } from "zod";

export function validateBody<TSchema extends z.ZodTypeAny>(schema: TSchema, body: unknown) {
  return schema.parse(body) as z.infer<TSchema>;
}
