import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const rootDir = resolve(process.env.AUTOMEDIA_BACKEND_DIR || process.cwd());
const logsDir = resolve(process.env.AUTOMEDIA_LOGS_DIR || join(rootDir, "..", "logs"));
const backendService = process.env.AUTOMEDIA_BACKEND_SERVICE || "automedia-backend";
const workerService = process.env.AUTOMEDIA_WORKER_SERVICE || "automedia-video-worker";
const healthUrl = process.env.AUTOMEDIA_HEALTH_URL || "http://localhost:3333/api/health";
const previousCommit = run("git", ["rev-parse", "HEAD"], { capture: true }).stdout.trim();
const deployLog = join(logsDir, "deploy-last.log");
const runId = new Date().toISOString();
const logLines = [`[${runId}] Deploy iniciado em ${rootDir}`];

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  logLines.push(line);
  console.log(message);
}

function persistLog() {
  mkdirSync(logsDir, { recursive: true });
  writeFileSync(deployLog, `${logLines.join("\n")}\n`);
}

function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: options.capture ? "utf8" : undefined,
    shell: false,
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (result.error || result.status !== 0) {
    const stderr = options.capture ? result.stderr : "";
    throw new Error(`${command} ${args.join(" ")} falhou. ${stderr || result.error?.message || ""}`.trim());
  }

  return result;
}

async function waitForHealth(timeoutMs = 30000) {
  const startedAt = Date.now();
  let lastError = "";

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(4000) });
      if (response.ok) return;
      lastError = `${response.status} ${await response.text()}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`Healthcheck falhou em ${healthUrl}. Último erro: ${lastError}`);
}

async function restartServices() {
  run("sudo", ["systemctl", "restart", backendService, workerService]);
  await waitForHealth();
}

async function rollback(error) {
  log(`Falha detectada: ${error instanceof Error ? error.message : String(error)}`);
  log(`Iniciando rollback para commit ${previousCommit}`);
  run("git", ["reset", "--hard", previousCommit]);
  run("npm", ["install"]);
  run("npm", ["run", "build"]);
  await restartServices();
  log("Rollback concluído e API saudável.");
}

try {
  if (!existsSync(join(rootDir, ".git"))) {
    throw new Error("Diretório atual não parece ser um repositório Git.");
  }

  log("Atualizando código...");
  run("git", ["pull", "--ff-only"]);

  log("Instalando dependências...");
  run("npm", ["install"]);

  log("Validando TypeScript e testes...");
  run("npm", ["run", "typecheck"]);
  run("npm", ["test"]);

  log("Gerando Prisma e compilando...");
  run("npm", ["run", "build"]);

  log("Aplicando schema no banco com segurança...");
  run("npm", ["run", "db:push:safe"]);
  run("npm", ["run", "db:verify:security"]);

  log("Reiniciando API e worker...");
  await restartServices();

  log("Deploy finalizado com sucesso.");
  persistLog();
} catch (error) {
  try {
    await rollback(error);
  } catch (rollbackError) {
    log(`Rollback também falhou: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
  }

  persistLog();
  process.exit(1);
}
