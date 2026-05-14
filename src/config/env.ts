import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3333),
  DATABASE_URL: z.string().default("postgresql://user:password@localhost:5432/automedia"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(16).default("change-me-in-production"),
  CORS_ORIGIN: z.string().default("http://localhost:5173,http://localhost:4173"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  UPLOADS_DIR: z.string().default("uploads"),
});

export const env = envSchema.parse(process.env);
