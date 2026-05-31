import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const databaseUrl = process.env.DATABASE_URL;
const backupsDir = process.env.BACKUPS_DIR || "backups";

if (!databaseUrl) {
  console.error("DATABASE_URL não configurada. Backup cancelado.");
  process.exit(1);
}

if (!existsSync(backupsDir)) {
  mkdirSync(backupsDir, { recursive: true });
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const output = join(backupsDir, `automedia-${stamp}.dump`);

console.log(`Criando backup em ${output}`);
const result = spawnSync("pg_dump", [databaseUrl, "--format=custom", "--no-owner", "--no-acl", "--file", output], {
  stdio: "inherit",
});

if (result.error) {
  console.error("Não foi possível executar pg_dump. Instale o PostgreSQL client ou use o backup nativo do provedor.");
  process.exit(1);
}

process.exit(result.status ?? 1);
