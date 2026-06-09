import { config } from "dotenv";
import { Redis } from "ioredis";

[".env", ".env.production", ".env.local"].forEach((path) => {
  config({ path, override: false });
});

const errors = [];
const warnings = [];

function requireEnv(key) {
  const value = process.env[key];
  if (!value) errors.push(`${key} nao configurada.`);
  return value;
}

function resolveRedisUrl() {
  const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
  if (!redisUrl) {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      errors.push("Upstash REST configurado, mas BullMQ precisa de UPSTASH_REDIS_URL/REDIS_URL no formato rediss://.");
      return undefined;
    }

    errors.push("REDIS_URL ou UPSTASH_REDIS_URL nao configurada.");
    return undefined;
  }

  if (redisUrl.startsWith("https://")) {
    errors.push("URL Redis invalida para BullMQ: use redis:// ou rediss://, nao URL REST https://.");
    return undefined;
  }

  return redisUrl;
}

async function checkRedis() {
  const redisUrl = resolveRedisUrl();
  if (!redisUrl) return;

  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 8000,
    ...(redisUrl.startsWith("rediss://") ? { tls: {} } : {}),
  });

  try {
    await redis.connect();
    const pong = await redis.ping();
    if (pong !== "PONG") errors.push(`Redis respondeu ${pong}, esperado PONG.`);
  } catch (error) {
    errors.push(`Redis indisponivel: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    redis.disconnect();
  }
}

async function checkStorage() {
  const storageDriver = process.env.STORAGE_DRIVER || "local";
  if (storageDriver === "s3") {
    ["S3_ENDPOINT", "S3_PUBLIC_URL", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"].forEach((key) => {
      if (!process.env[key]) errors.push(`${key} nao configurada para storage S3/MinIO.`);
    });
    return;
  }

  if (storageDriver !== "supabase") {
    warnings.push("STORAGE_DRIVER esta local. Videos gerados nao terao storage persistente em producao.");
    return;
  }

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const bucket = requireEnv("SUPABASE_STORAGE_BUCKET");
  if (!supabaseUrl || !serviceRoleKey || !bucket) return;

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/storage/v1/bucket/${bucket}`, {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
    });

    if (!response.ok) {
      const message = await response.text();
      errors.push(`Supabase bucket "${bucket}" indisponivel: ${response.status} ${message}`);
      return;
    }

    const payload = await response.json();
    if (payload?.public !== true) {
      warnings.push(`Bucket "${bucket}" nao parece publico. Os previews podem exigir URL assinada.`);
    }
  } catch (error) {
    errors.push(`Supabase Storage indisponivel: ${error instanceof Error ? error.message : String(error)}`);
  }
}

await checkRedis();
await checkStorage();

if (errors.length > 0) {
  console.error("Falha na checagem de infraestrutura:");
  errors.forEach((item) => console.error(`- ${item}`));
  warnings.forEach((item) => console.warn(`Aviso: ${item}`));
  process.exit(1);
}

console.log("Checklist de infraestrutura aprovado.");
warnings.forEach((item) => console.warn(`Aviso: ${item}`));
