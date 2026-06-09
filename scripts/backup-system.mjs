import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { config } from "dotenv";

[".env", ".env.production", ".env.local"].forEach((path) => {
  config({ path, override: false });
});

const databaseUrl = process.env.DATABASE_URL;
const backupsDir = resolve(process.env.BACKUPS_DIR || "backups");
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 14);
const minioDataDir = process.env.MINIO_DATA_DIR ? resolve(process.env.MINIO_DATA_DIR) : resolve(process.cwd(), "..", "data", "minio");

function run(command, args, errorMessage) {
  const result = spawnSync(command, args, { stdio: "inherit" });

  if (result.error || result.status !== 0) {
    throw new Error(errorMessage);
  }
}

function createBackupDir() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = join(backupsDir, stamp);
  mkdirSync(backupDir, { recursive: true });
  return { stamp, backupDir };
}

function backupDatabase(backupDir) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL não configurada. Backup do banco cancelado.");
  }

  const output = join(backupDir, "postgres.dump");
  console.log(`Criando backup PostgreSQL em ${output}`);
  run("pg_dump", [databaseUrl, "--format=custom", "--no-owner", "--no-acl", "--file", output], "Falha ao executar pg_dump. Instale o pacote postgresql-client na VM.");
  return output;
}

function backupMinio(backupDir) {
  if (!existsSync(minioDataDir)) {
    console.warn(`Aviso: diretório do MinIO não encontrado em ${minioDataDir}. Pulando backup de mídia.`);
    return null;
  }

  const output = join(backupDir, "minio-data.tar.gz");
  console.log(`Criando backup MinIO em ${output}`);
  run("tar", ["-czf", output, "-C", minioDataDir, "."], "Falha ao compactar dados do MinIO.");
  return output;
}

function pruneOldBackups() {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0 || !existsSync(backupsDir)) return [];

  const now = Date.now();
  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
  const removed = [];

  for (const entry of readdirSync(backupsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const fullPath = join(backupsDir, entry.name);
    const createdAt = statSync(fullPath).mtimeMs;

    if (now - createdAt > maxAgeMs) {
      rmSync(fullPath, { recursive: true, force: true });
      removed.push(entry.name);
    }
  }

  return removed;
}

try {
  mkdirSync(backupsDir, { recursive: true });
  const { stamp, backupDir } = createBackupDir();
  const databaseBackup = backupDatabase(backupDir);
  const minioBackup = backupMinio(backupDir);
  const removed = pruneOldBackups();

  const manifest = {
    created_at: new Date().toISOString(),
    backup_id: stamp,
    files: {
      database: basename(databaseBackup),
      minio: minioBackup ? basename(minioBackup) : null,
    },
    retention_days: retentionDays,
    removed_old_backups: removed,
  };

  writeFileSync(join(backupDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Backup completo finalizado em ${backupDir}`);

  if (removed.length > 0) {
    console.log(`Backups antigos removidos: ${removed.join(", ")}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
