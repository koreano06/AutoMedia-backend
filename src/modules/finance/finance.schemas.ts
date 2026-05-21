import { z } from "zod";

export const expensePayloadSchema = z.object({
  category: z.string().min(1),
  description: z.string().optional(),
  amount: z.union([z.number(), z.string()]),
  currency: z.string().default("BRL").optional(),
  spent_at: z.string().optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const salesOrderItemPayloadSchema = z.object({
  product_id: z.string().optional(),
  product_name: z.string().min(1),
  sku: z.string().optional(),
  quantity: z.number().int().positive().default(1),
  unit_price: z.union([z.number(), z.string()]),
  unit_cost: z.union([z.number(), z.string()]).optional(),
});

export const salesOrderPayloadSchema = z.object({
  customer_name: z.string().optional(),
  customer_email: z.string().optional(),
  platform: z.string().optional(),
  status: z.string().default("paid").optional(),
  discount: z.union([z.number(), z.string()]).optional(),
  shipping: z.union([z.number(), z.string()]).optional(),
  currency: z.string().default("BRL").optional(),
  external_order_id: z.string().optional(),
  sold_at: z.string().optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  items: z.array(salesOrderItemPayloadSchema).min(1),
});
