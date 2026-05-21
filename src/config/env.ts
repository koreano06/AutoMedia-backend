import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3333),
  DATABASE_URL: z.string().default("postgresql://user:password@localhost:5432/automedia"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(16).default("change-me-in-production"),
  CORS_ORIGIN: z.string().default("https://auto-media-sooty.vercel.app,http://localhost:5173,http://localhost:4173"),
  FRONTEND_URL: z.string().url().default("https://auto-media-sooty.vercel.app"),
  API_PUBLIC_URL: z.string().url().default("https://auto-media-backend.vercel.app"),
  SOCIAL_INTEGRATIONS_MODE: z.enum(["mock", "live"]).default("mock"),
  META_CLIENT_ID: z.string().optional(),
  META_CLIENT_SECRET: z.string().optional(),
  META_REDIRECT_URI: z.string().url().optional(),
  META_GRAPH_VERSION: z.string().default("v21.0"),
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  TIKTOK_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  YOUTUBE_REDIRECT_URI: z.string().url().optional(),
  MERCADOLIVRE_CLIENT_ID: z.string().optional(),
  MERCADOLIVRE_CLIENT_SECRET: z.string().optional(),
  MERCADOLIVRE_REDIRECT_URI: z.string().url().optional(),
  SHOPEE_PARTNER_ID: z.string().optional(),
  SHOPEE_PARTNER_KEY: z.string().optional(),
  SHOPEE_REDIRECT_URI: z.string().url().optional(),
  SHOPEE_API_BASE_URL: z.string().url().default("https://partner.shopeemobile.com"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_IMAGE_MODEL: z.string().default("gpt-image-1"),
  OPENAI_IMAGE_QUALITY: z.enum(["low", "medium", "high"]).default("high"),
  OPENAI_IMAGE_FALLBACK_ENABLED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  UPLOADS_DIR: z.string().default("uploads"),
});

export const env = envSchema.parse(process.env);
