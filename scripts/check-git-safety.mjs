import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
  cwd: repoRoot,
  encoding: "utf8",
}).split("\0").filter(Boolean);

const blockedPathPatterns = [
  /^\.env(?:\..+)?$/i,
  /^\.npmrc$/i,
  /^\.envrc$/i,
  /^backups\/(?!\.gitkeep$)/i,
  /^uploads\/(?!\.gitkeep$)/i,
  /^logs\//i,
  /\.(pem|key|p12|pfx|kdbx|bak|backup|dump|tar|tgz|gz|zip|log)$/i,
];

const allowedTrackedFiles = new Set([
  ".env.example",
  ".env.vm.example",
  "backups/.gitkeep",
  "uploads/.gitkeep",
]);

const hardSecretPatterns = [
  { label: "private key block", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { label: "GitHub token", regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { label: "OpenAI-style secret", regex: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { label: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: "Google API key", regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { label: "Slack token", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
];

const sensitiveEnvNames = [
  "OPENAI_API_KEY",
  "OPENAI_ADMIN_API_KEY",
  "JWT_SECRET",
  "ENCRYPTION_KEY",
  "REPLICATE_API_TOKEN",
  "S3_SECRET_ACCESS_KEY",
  "S3_ACCESS_KEY_ID",
  "SUPABASE_SERVICE_ROLE_KEY",
  "META_CLIENT_SECRET",
  "TIKTOK_CLIENT_SECRET",
  "GOOGLE_CLIENT_SECRET",
  "MERCADOLIVRE_CLIENT_SECRET",
  "SHOPEE_PARTNER_KEY",
  "WEBHOOK_SECRET",
  "ALERT_WEBHOOK_URL",
  "DATABASE_URL",
  "REDIS_URL",
  "UPSTASH_REDIS_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

const placeholderMarkers = [
  "",
  "...",
  "changeme",
  "change-me",
  "change_me",
  "trocar",
  "example",
  "localhost",
  "127.0.0.1",
  "user:password",
  "usuario:senha",
  "postgres:postgres",
  "ip_da_vm",
  "uma-chave-forte",
];

function normalizeValue(value) {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function looksLikePlaceholder(value) {
  const normalized = normalizeValue(value).toLowerCase();
  if (!normalized) return true;
  return placeholderMarkers.some((marker) => normalized.includes(marker));
}

function isExampleFile(file) {
  return file === ".env.example" || file === ".env.vm.example";
}

function isBinaryContent(content) {
  return content.includes("\u0000");
}

const issues = [];

for (const file of trackedFiles) {
  const normalizedPath = file.replace(/\\/g, "/");

  if (!allowedTrackedFiles.has(normalizedPath) && blockedPathPatterns.some((pattern) => pattern.test(normalizedPath))) {
    issues.push(`[tracked-file] ${normalizedPath} nao deve ser versionado.`);
    continue;
  }

  const absolutePath = path.join(repoRoot, normalizedPath);
  let content;

  try {
    content = readFileSync(absolutePath, "utf8");
  } catch {
    continue;
  }

  if (isBinaryContent(content)) continue;

  for (const rule of hardSecretPatterns) {
    if (rule.regex.test(content)) {
      issues.push(`[secret-pattern] ${normalizedPath} parece conter ${rule.label}.`);
    }
  }

  const lines = content.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (!match) continue;

    const [, name, rawValue] = match;
    if (!sensitiveEnvNames.includes(name)) continue;

    if (isExampleFile(normalizedPath) && looksLikePlaceholder(rawValue)) continue;
    if (!isExampleFile(normalizedPath) && looksLikePlaceholder(rawValue)) continue;

    issues.push(`[env-value] ${normalizedPath}:${index + 1} contem ${name} com valor que nao parece placeholder.`);
  }
}

if (issues.length) {
  console.error("Falha na checagem de seguranca do Git:\n");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log("Git safety check OK: nenhum segredo ou arquivo proibido detectado nos arquivos rastreados.");
