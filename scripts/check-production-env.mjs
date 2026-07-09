import { config } from "dotenv";

[".env", ".env.production", ".env.local"].forEach((path) => {
  config({ path, override: false });
});

const required = [
  "DATABASE_URL",
  "JWT_SECRET",
  "ENCRYPTION_KEY",
  "CORS_ORIGIN",
  "FRONTEND_URL",
  "API_PUBLIC_URL",
];

const missing = required.filter((key) => !process.env[key]);
const warnings = [];

const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;

if (!redisUrl) {
  missing.push("REDIS_URL ou UPSTASH_REDIS_URL");
} else if (redisUrl.startsWith("https://")) {
  missing.push("REDIS_URL/UPSTASH_REDIS_URL deve usar redis:// ou rediss:// para BullMQ");
}

if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  warnings.push("JWT_SECRET tem menos de 32 caracteres. Use um segredo maior em producao.");
}

if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length < 32) {
  warnings.push("ENCRYPTION_KEY tem menos de 32 caracteres. Use uma chave maior em producao.");
}

if (process.env.JWT_SECRET === "change-me-in-production") {
  missing.push("JWT_SECRET ainda usa o valor padrao inseguro");
}

if (process.env.DATABASE_URL?.includes("localhost")) {
  warnings.push("DATABASE_URL aponta para localhost.");
}

if (redisUrl?.includes("localhost")) {
  warnings.push("REDIS_URL aponta para localhost.");
}

if (process.env.UPSTASH_REDIS_REST_URL && !process.env.UPSTASH_REDIS_URL && !process.env.REDIS_URL) {
  warnings.push("Upstash REST está configurado, mas BullMQ precisa da URL Redis TCP/TLS rediss://.");
}

if (process.env.CORS_ORIGIN?.split(",").map((origin) => origin.trim()).includes("*")) {
  missing.push("CORS_ORIGIN nao pode conter * em producao.");
}

if (process.env.FRONTEND_URL && process.env.CORS_ORIGIN && !process.env.CORS_ORIGIN.includes(process.env.FRONTEND_URL)) {
  warnings.push("FRONTEND_URL nao aparece dentro de CORS_ORIGIN.");
}

if (process.env.API_PUBLIC_URL?.startsWith("http://")) {
  warnings.push("API_PUBLIC_URL esta em HTTP. Para producao publica profissional, prefira HTTPS.");
}

if (process.env.STORAGE_DRIVER === "supabase") {
  ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_STORAGE_BUCKET"].forEach((key) => {
    if (!process.env[key]) missing.push(key);
  });
} else if (process.env.STORAGE_DRIVER === "s3") {
  ["S3_ENDPOINT", "S3_PUBLIC_URL", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"].forEach((key) => {
    if (!process.env[key]) missing.push(key);
  });
} else {
  warnings.push("STORAGE_DRIVER esta local. Em producao, use s3/MinIO ou supabase para persistir arquivos.");
}

if (process.env.VIDEO_RENDER_DRIVER === "ffmpeg" && !process.env.FFMPEG_PATH) {
  missing.push("FFMPEG_PATH");
}

if (process.env.OPENAI_IMAGE_FALLBACK_ENABLED === "true") {
  warnings.push("OPENAI_IMAGE_FALLBACK_ENABLED esta true. Em producao profissional, prefira false.");
}

if (!process.env.OPENAI_API_KEY) {
  warnings.push("OPENAI_API_KEY nao configurada. Imagens profissionais com IA nao serao geradas.");
}

if (process.env.SOCIAL_INTEGRATIONS_MODE === "live") {
  const liveKeys = [
    "META_CLIENT_ID",
    "META_CLIENT_SECRET",
    "TIKTOK_CLIENT_KEY",
    "TIKTOK_CLIENT_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "MERCADOLIVRE_CLIENT_ID",
    "MERCADOLIVRE_CLIENT_SECRET",
    "SHOPEE_PARTNER_ID",
    "SHOPEE_PARTNER_KEY",
  ];

  liveKeys.forEach((key) => {
    if (!process.env[key]) warnings.push(`${key} ausente para integracoes live.`);
  });
}

if (missing.length > 0) {
  console.error("Falha na checagem de producao do backend:");
  missing.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log("Checklist de producao do backend aprovado.");
warnings.forEach((item) => console.warn(`Aviso: ${item}`));
