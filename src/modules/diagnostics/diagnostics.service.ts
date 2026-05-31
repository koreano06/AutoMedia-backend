import { prisma } from "../../database/prisma.js";
import { env } from "../../config/env.js";
import { getQueueConnection } from "../../queue/queue.client.js";

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok" };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  }
}

async function checkRedis() {
  try {
    const pong = await getQueueConnection().ping();
    return { status: pong === "PONG" ? "ok" : "error", message: pong };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  }
}

function checkStorage() {
  if (env.STORAGE_DRIVER === "supabase") {
    const configured = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_STORAGE_BUCKET);
    return { status: configured ? "ok" : "warning", driver: env.STORAGE_DRIVER, bucket: env.SUPABASE_STORAGE_BUCKET };
  }

  return { status: env.NODE_ENV === "production" ? "warning" : "ok", driver: env.STORAGE_DRIVER };
}

function checkOpenAI() {
  return { status: env.OPENAI_API_KEY ? "ok" : "warning", image_model: env.OPENAI_IMAGE_MODEL };
}

export const diagnosticsService = {
  async check() {
    const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);

    return {
      status: [database.status, redis.status].includes("error") ? "degraded" : "ok",
      checked_at: new Date().toISOString(),
      services: {
        database,
        redis,
        storage: checkStorage(),
        openai: checkOpenAI(),
        worker: {
          status: "external",
          command: "npm run worker:video",
        },
      },
    };
  },
};
