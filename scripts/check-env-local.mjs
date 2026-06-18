import { existsSync, readFileSync } from "node:fs";
import { config } from "dotenv";

const envPath = ".env.local";

if (!existsSync(envPath)) {
  console.error("Arquivo .env.local nao encontrado.");
  console.error("Na VM, crie com: cp .env.vm.example .env.local");
  process.exit(1);
}

config({ path: envPath, override: true });

const required = [
  "NODE_ENV",
  "PORT",
  "DATABASE_URL",
  "REDIS_URL",
  "JWT_SECRET",
  "ENCRYPTION_KEY",
  "CORS_ORIGIN",
  "FRONTEND_URL",
  "API_PUBLIC_URL",
  "STORAGE_DRIVER",
  "VIDEO_RENDER_DRIVER",
  "FFMPEG_PATH",
];

const provider = process.env.AI_VIDEO_PROVIDER || "ffmpeg";
if (provider === "replicate_kling") {
  required.push("REPLICATE_API_TOKEN");
}

if (process.env.STORAGE_DRIVER === "s3") {
  required.push("S3_ENDPOINT", "S3_PUBLIC_URL", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY");
}

if (process.env.STORAGE_DRIVER === "supabase") {
  required.push("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_STORAGE_BUCKET");
}

const errors = [];
const warnings = [];

function mask(value = "") {
  if (!value) return "vazio";
  if (value.length <= 10) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 6)}...${value.slice(-4)} (${value.length} chars)`;
}

function hasPlaceholder(value = "") {
  return /TROCAR|change-me|change_me|COLE_SUA|your_|sua_/i.test(value);
}

for (const key of required) {
  const value = process.env[key] || "";
  if (!value) {
    errors.push(`${key} ausente.`);
    continue;
  }
  if (hasPlaceholder(value)) {
    errors.push(`${key} ainda parece placeholder.`);
  }
}

if ((process.env.JWT_SECRET || "").length < 32) {
  errors.push("JWT_SECRET precisa ter pelo menos 32 caracteres.");
}

if ((process.env.ENCRYPTION_KEY || "").length < 32) {
  errors.push("ENCRYPTION_KEY precisa ter pelo menos 32 caracteres.");
}

if ((process.env.CORS_ORIGIN || "").includes("*")) {
  errors.push("CORS_ORIGIN nao deve usar *.");
}

if (process.env.FRONTEND_URL && process.env.CORS_ORIGIN && !process.env.CORS_ORIGIN.includes(process.env.FRONTEND_URL)) {
  warnings.push("FRONTEND_URL nao aparece em CORS_ORIGIN.");
}

if (process.env.NODE_ENV === "production" && (process.env.API_PUBLIC_URL || "").startsWith("http://")) {
  warnings.push("API_PUBLIC_URL esta em HTTP. Funciona em LAN/tunnel, mas HTTPS sera necessario para producao publica.");
}

if (process.env.SOCIAL_INTEGRATIONS_MODE === "live") {
  const socialKeys = [
    "META_CLIENT_ID",
    "META_CLIENT_SECRET",
    "TIKTOK_CLIENT_KEY",
    "TIKTOK_CLIENT_SECRET",
  ];
  for (const key of socialKeys) {
    if (!process.env[key]) warnings.push(`${key} ausente para modo live.`);
  }
}

const raw = readFileSync(envPath, "utf8");
if (/sk-[A-Za-z0-9_-]{20,}/.test(raw)) {
  warnings.push("OPENAI_API_KEY detectada no .env.local. Isso e esperado na VM, mas nunca commite esse arquivo.");
}

console.log("Resumo seguro do .env.local:");
[
  "NODE_ENV",
  "PORT",
  "DATABASE_URL",
  "REDIS_URL",
  "FRONTEND_URL",
  "API_PUBLIC_URL",
  "STORAGE_DRIVER",
  "S3_PUBLIC_URL",
  "AI_VIDEO_PROVIDER",
  "REPLICATE_API_TOKEN",
  "OPENAI_API_KEY",
  "OPENAI_ADMIN_API_KEY",
  "SOCIAL_INTEGRATIONS_MODE",
].forEach((key) => {
  console.log(`- ${key}: ${mask(process.env[key])}`);
});

warnings.forEach((item) => console.warn(`Aviso: ${item}`));

if (errors.length > 0) {
  console.error("Falha na validacao segura do .env.local:");
  errors.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log("Validacao segura do .env.local aprovada.");
