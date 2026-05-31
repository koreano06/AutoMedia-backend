import { spawnSync } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL não configurada. Migração cancelada.");
  process.exit(1);
}

const maskedHost = (() => {
  try {
    const url = new URL(databaseUrl);
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return "DATABASE_URL inválida";
  }
})();

console.log(`Banco alvo: ${maskedHost}`);
console.log("Executando prisma db push com geração do client...");

const result = spawnSync("npx", ["prisma", "db", "push", "--schema", "prisma/schema.prisma"], {
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
