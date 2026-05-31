import { env } from "./env.js";

const redisUrl = env.REDIS_URL || env.UPSTASH_REDIS_URL || (env.NODE_ENV === "development" ? "redis://localhost:6379" : undefined);

export const queueConfig = {
  redisUrl,
  isTls: redisUrl?.startsWith("rediss://") || false,
  provider: env.UPSTASH_REDIS_URL || env.UPSTASH_REDIS_REST_URL ? "upstash" : "redis",
  hasRestFallback: Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
};

export function requireQueueRedisUrl() {
  if (!queueConfig.redisUrl) {
    throw new Error("REDIS_URL ou UPSTASH_REDIS_URL precisa estar configurada para filas BullMQ.");
  }

  if (queueConfig.redisUrl.startsWith("https://")) {
    throw new Error("BullMQ precisa de URL Redis TCP/TLS (redis:// ou rediss://), não URL REST do Upstash.");
  }

  return queueConfig.redisUrl;
}
