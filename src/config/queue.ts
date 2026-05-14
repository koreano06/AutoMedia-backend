import { env } from "./env.js";

export const queueConfig = {
  redisUrl: env.REDIS_URL,
};
