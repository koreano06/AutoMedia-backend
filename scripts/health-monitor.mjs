import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { config } from "dotenv";
import { Redis } from "ioredis";

[".env", ".env.production", ".env.local"].forEach((path) => {
  config({ path, override: false });
});

const rootDir = resolve(process.env.AUTOMEDIA_BACKEND_DIR || process.cwd());
const logsDir = resolve(process.env.AUTOMEDIA_LOGS_DIR || join(rootDir, "..", "logs"));
const logFile = join(logsDir, "health-monitor.log");
const healthUrl = process.env.AUTOMEDIA_HEALTH_URL || "http://localhost:3333/api/health";
const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
const backupDir = resolve(process.env.BACKUPS_DIR || join(rootDir, "backups"));
const maxBackupAgeHours = Number(process.env.BACKUP_MAX_AGE_HOURS || 30);
const errors = [];
const warnings = [];

function writeLog(level, message) {
  mkdirSync(logsDir, { recursive: true });
  appendFileSync(logFile, `[${new Date().toISOString()}] ${level}: ${message}\n`);
}

async function checkApi() {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) errors.push(`API healthcheck falhou: ${response.status}`);
  } catch (error) {
    errors.push(`API indisponível: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function checkRedis() {
  if (!redisUrl) {
    errors.push("REDIS_URL/UPSTASH_REDIS_URL ausente.");
    return;
  }

  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    ...(redisUrl.startsWith("rediss://") ? { tls: {} } : {}),
  });

  try {
    await redis.connect();
    const pong = await redis.ping();
    if (pong !== "PONG") errors.push(`Redis respondeu ${pong}, esperado PONG.`);
  } catch (error) {
    errors.push(`Redis indisponível: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    redis.disconnect();
  }
}

async function checkStorageConfig() {
  const driver = process.env.STORAGE_DRIVER || "local";
  if (driver === "local") warnings.push("Storage local ativo. Para produção real, use MinIO/S3 ou Supabase.");
  if (driver === "s3") {
    ["S3_ENDPOINT", "S3_PUBLIC_URL", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"].forEach((key) => {
      if (!process.env[key]) errors.push(`${key} ausente para storage S3/MinIO.`);
    });
  }
}

async function checkRecentBackup() {
  if (!existsSync(backupDir)) {
    warnings.push(`Diretório de backup não encontrado: ${backupDir}`);
    return;
  }

  const { readdirSync, statSync } = await import("node:fs");
  const backups = readdirSync(backupDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => statSync(join(backupDir, entry.name)).mtimeMs)
    .sort((a, b) => b - a);

  if (backups.length === 0) {
    warnings.push("Nenhum backup completo encontrado.");
    return;
  }

  const ageHours = (Date.now() - backups[0]) / 1000 / 60 / 60;
  if (ageHours > maxBackupAgeHours) {
    warnings.push(`Backup mais recente tem ${ageHours.toFixed(1)}h, acima do limite de ${maxBackupAgeHours}h.`);
  }
}

await checkApi();
await checkRedis();
await checkStorageConfig();
await checkRecentBackup();

if (errors.length > 0) {
  errors.forEach((error) => writeLog("ERROR", error));
  warnings.forEach((warning) => writeLog("WARN", warning));
  console.error("Monitoramento encontrou falhas:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

warnings.forEach((warning) => writeLog("WARN", warning));
writeLog("OK", warnings.length ? `Saudável com ${warnings.length} aviso(s).` : "Ambiente saudável.");
console.log("Monitoramento aprovado.");
