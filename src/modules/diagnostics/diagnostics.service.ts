import { prisma } from "../../database/prisma.js";
import { env } from "../../config/env.js";
import { getQueueConnection } from "../../queue/queue.client.js";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { requireWorkspaceId } from "../../shared/utils/workspace.js";

type DiagnosticUser = {
  id: string;
  role: string;
  workspace_id?: string;
};

type RunChecksPayload = {
  checks?: string[];
};

type CheckStatus = "ok" | "warning" | "error";

type CheckResult = {
  id: string;
  status: CheckStatus;
  title: string;
  message: string;
  duration_ms: number;
  metadata?: Record<string, string | number | boolean | null>;
};

type ProductionChecklistItem = {
  id: string;
  title: string;
  status: CheckStatus;
  detail: string;
};

const availableChecks = ["auth", "database_write", "storage", "queue", "ai", "video_pipeline", "mock_publish", "latency", "contracts", "permissions"] as const;

async function timedCheck(id: string, title: string, action: () => Promise<Omit<CheckResult, "id" | "title" | "duration_ms">>): Promise<CheckResult> {
  const start = Date.now();

  try {
    const result = await action();
    return {
      id,
      title,
      duration_ms: Date.now() - start,
      ...result,
    };
  } catch (error) {
    return {
      id,
      title,
      status: "error",
      message: error instanceof Error ? error.message : "Falha inesperada no check.",
      duration_ms: Date.now() - start,
    };
  }
}

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
  if (env.STORAGE_DRIVER === "s3") {
    const configured = Boolean(env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);
    return { status: configured ? "ok" : "warning", driver: env.STORAGE_DRIVER, bucket: env.S3_BUCKET || null };
  }

  if (env.STORAGE_DRIVER === "supabase") {
    const configured = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_STORAGE_BUCKET);
    return { status: configured ? "ok" : "warning", driver: env.STORAGE_DRIVER, bucket: env.SUPABASE_STORAGE_BUCKET };
  }

  return { status: env.NODE_ENV === "production" ? "warning" : "ok", driver: env.STORAGE_DRIVER };
}

function checkOpenAI() {
  return {
    status: env.OPENAI_API_KEY ? "ok" : "warning",
    image_model: env.OPENAI_IMAGE_MODEL,
    video_provider: env.AI_VIDEO_PROVIDER,
    replicate_configured: Boolean(env.REPLICATE_API_TOKEN),
  };
}

function logsDir() {
  return resolve(process.env.AUTOMEDIA_LOGS_DIR || join(process.cwd(), "..", "logs"));
}

function backupsDir() {
  return resolve(process.env.BACKUPS_DIR || join(process.cwd(), "backups"));
}

function latestDirectoryAgeHours(directory: string) {
  if (!existsSync(directory)) return null;
  const entries = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => statSync(join(directory, entry.name)).mtimeMs)
    .sort((a, b) => b - a);

  if (!entries.length) return null;
  return (Date.now() - entries[0]) / 1000 / 60 / 60;
}

function item(id: string, title: string, status: CheckStatus, detail: string): ProductionChecklistItem {
  return { id, title, status, detail };
}

async function checkVideoPipeline(user?: DiagnosticUser) {
  const staleThreshold = new Date(Date.now() - 15 * 60 * 1000);
  const recentFailureThreshold = new Date(Date.now() - 60 * 60 * 1000);
  const workspaceFilter = user?.workspace_id ? { workspaceId: user.workspace_id } : {};

  const [activeCount, staleJobs, recentFailedCount] = await Promise.all([
    prisma.job.count({
      where: {
        ...workspaceFilter,
        type: "video_generation",
        status: { in: ["queued", "processing", "rendering", "uploading"] },
      },
    }),
    prisma.job.findMany({
      where: {
        ...workspaceFilter,
        type: "video_generation",
        status: { in: ["queued", "processing", "rendering", "uploading"] },
        updatedAt: { lt: staleThreshold },
      },
      orderBy: { updatedAt: "asc" },
      take: 3,
      select: {
        id: true,
        status: true,
        updatedAt: true,
        title: true,
      },
    }),
    prisma.job.count({
      where: {
        ...workspaceFilter,
        type: "video_generation",
        status: "failed",
        updatedAt: { gte: recentFailureThreshold },
      },
    }),
  ]);

  const status: CheckStatus = staleJobs.length > 0 ? "warning" : "ok";

  return {
    status,
    message: staleJobs.length
      ? `${staleJobs.length} job(s) de vídeo parecem travados há mais de 15 minutos.`
      : "Pipeline de vídeo sem jobs travados.",
    active_count: activeCount,
    stale_count: staleJobs.length,
    failed_last_hour: recentFailedCount,
    stale_job_id: staleJobs[0]?.id || null,
    stale_job_status: staleJobs[0]?.status || null,
  };
}

async function runAuthCheck(user?: DiagnosticUser) {
  return timedCheck("auth", "Autenticação", async () => {
    if (!user) {
      return { status: "error", message: "Usuário não autenticado." };
    }

    return {
      status: "ok",
      message: "Token autenticado e usuário carregado.",
      metadata: {
        role: user.role,
        workspace_id: user.workspace_id || null,
      },
    };
  });
}

async function runDatabaseWriteCheck(user?: DiagnosticUser) {
  return timedCheck("database_write", "Escrita segura no banco", async () => {
    const workspaceId = requireWorkspaceId(user?.workspace_id);
    const job = await prisma.job.create({
      data: {
        workspaceId,
        type: "diagnostic_check",
        title: "Diagnóstico temporário",
        status: "queued",
        progress: 0,
        payload: { temporary: true, source: "diagnostics.runChecks" },
      },
    });

    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "completed",
        progress: 100,
        completedAt: new Date(),
      },
    });

    await prisma.job.delete({ where: { id: job.id } });

    return {
      status: "ok",
      message: "Create, update e delete temporários executados com sucesso.",
      metadata: { workspace_id: workspaceId },
    };
  });
}

async function runStorageCheck() {
  return timedCheck("storage", "Storage", async () => {
    if (env.STORAGE_DRIVER === "s3") {
      const configured = Boolean(env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);
      return {
        status: configured ? "ok" : "warning",
        message: configured ? "S3/MinIO configurado para storage persistente." : "S3/MinIO selecionado, mas variáveis obrigatórias estão incompletas.",
        metadata: {
          driver: env.STORAGE_DRIVER,
          bucket: env.S3_BUCKET || null,
        },
      };
    }

    if (env.STORAGE_DRIVER === "supabase") {
      const configured = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_STORAGE_BUCKET);
      return {
        status: configured ? "ok" : "warning",
        message: configured ? "Supabase Storage configurado." : "Supabase Storage selecionado, mas variáveis obrigatórias estão incompletas.",
        metadata: {
          driver: env.STORAGE_DRIVER,
          bucket: env.SUPABASE_STORAGE_BUCKET || null,
        },
      };
    }

    return {
      status: env.NODE_ENV === "production" ? "warning" : "ok",
      message: env.NODE_ENV === "production" ? "Storage local em produção não é persistente entre deploys." : "Storage local aceitável para desenvolvimento.",
      metadata: { driver: env.STORAGE_DRIVER, bucket: null },
    };
  });
}

async function runQueueCheck() {
  return timedCheck("queue", "Fila Redis", async () => {
    const pong = await getQueueConnection().ping();
    return {
      status: pong === "PONG" ? "ok" : "error",
      message: pong === "PONG" ? "Redis respondeu PONG." : `Redis respondeu ${pong}.`,
      metadata: { response: pong },
    };
  });
}

async function runAICheck() {
  return timedCheck("ai", "OpenAI", async () => ({
    status: env.OPENAI_API_KEY ? "ok" : "warning",
    message: env.OPENAI_API_KEY ? "Chave OpenAI configurada. Chamada paga não foi executada neste teste rápido." : "OPENAI_API_KEY ausente.",
    metadata: {
      text_model: env.OPENAI_TEXT_MODEL,
      image_model: env.OPENAI_IMAGE_MODEL,
      fallback_enabled: String(env.OPENAI_IMAGE_FALLBACK_ENABLED),
      video_provider: env.AI_VIDEO_PROVIDER,
      replicate_configured: Boolean(env.REPLICATE_API_TOKEN),
      ai_video_fallback_to_ffmpeg: String(env.AI_VIDEO_FALLBACK_TO_FFMPEG),
    },
  }));
}

async function runVideoPipelineCheck(user?: DiagnosticUser) {
  return timedCheck("video_pipeline", "Pipeline de vídeo", async () => {
    const pipeline = await checkVideoPipeline(user);

    return {
      status: pipeline.status,
      message: pipeline.message,
      metadata: {
        active_count: pipeline.active_count,
        stale_count: pipeline.stale_count,
        failed_last_hour: pipeline.failed_last_hour,
        stale_job_id: pipeline.stale_job_id,
        stale_job_status: pipeline.stale_job_status,
      },
    };
  });
}

async function runMockPublishCheck(user?: DiagnosticUser) {
  return timedCheck("mock_publish", "Publicação simulada", async () => {
    const account = await prisma.platformAccount.findFirst({
      where: {
        workspaceId: user?.workspace_id,
        status: "connected",
      },
      select: {
        platform: true,
        status: true,
      },
    });

    if (env.SOCIAL_INTEGRATIONS_MODE !== "mock") {
      return {
        status: "warning",
        message: "Integrações estão em modo live. Teste não publica nada para evitar disparo real.",
        metadata: { mode: env.SOCIAL_INTEGRATIONS_MODE, platform: null },
      };
    }

    return {
      status: account ? "ok" : "warning",
      message: account ? `Publicação mock apta para ${account.platform}.` : "Modo mock ativo, mas nenhuma conta conectada foi encontrada.",
      metadata: {
        mode: env.SOCIAL_INTEGRATIONS_MODE,
        platform: account?.platform || null,
      },
    };
  });
}

async function runLatencyCheck(user?: DiagnosticUser) {
  return timedCheck("latency", "Latência interna", async () => {
    const databaseStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const databaseMs = Date.now() - databaseStart;

    const productsStart = Date.now();
    await prisma.product.count({ where: { workspaceId: user?.workspace_id } });
    const productsMs = Date.now() - productsStart;

    const status: CheckStatus = databaseMs > 1500 || productsMs > 1500 ? "warning" : "ok";

    return {
      status,
      message: status === "ok" ? "Latência interna saudável." : "Alguma consulta demorou mais que o esperado.",
      metadata: {
        database_ms: databaseMs,
        products_count_ms: productsMs,
      },
    };
  });
}

async function runContractsCheck(user?: DiagnosticUser) {
  return timedCheck("contracts", "Contratos de resposta", async () => {
    const [products, media, posts, jobs] = await Promise.all([
      prisma.product.findMany({ where: { workspaceId: user?.workspace_id }, take: 1 }),
      prisma.mediaAsset.findMany({ where: { workspaceId: user?.workspace_id }, take: 1 }),
      prisma.post.findMany({ where: { workspaceId: user?.workspace_id }, take: 1 }),
      prisma.job.findMany({ where: { workspaceId: user?.workspace_id }, take: 1 }),
    ]);

    const valid = Array.isArray(products) && Array.isArray(media) && Array.isArray(posts) && Array.isArray(jobs);

    return {
      status: valid ? "ok" : "error",
      message: valid ? "Contratos principais retornaram listas válidas." : "Algum contrato principal não retornou lista.",
      metadata: {
        products: products.length,
        media_assets: media.length,
        posts: posts.length,
        jobs: jobs.length,
      },
    };
  });
}

async function runPermissionsCheck(user?: DiagnosticUser) {
  return timedCheck("permissions", "Permissões", async () => {
    const isAdmin = user?.role === "admin";
    return {
      status: isAdmin ? "ok" : "warning",
      message: isAdmin ? "Usuário atual tem permissões administrativas." : "Usuário atual não é admin; ações sensíveis devem permanecer bloqueadas.",
      metadata: {
        role: user?.role || null,
        can_publish: isAdmin,
        can_manage_platforms: isAdmin,
        can_delete_products: isAdmin,
      },
    };
  });
}

const checkRunners: Record<string, (user?: DiagnosticUser) => Promise<CheckResult>> = {
  auth: runAuthCheck,
  database_write: runDatabaseWriteCheck,
  storage: runStorageCheck,
  queue: runQueueCheck,
  ai: runAICheck,
  video_pipeline: runVideoPipelineCheck,
  mock_publish: runMockPublishCheck,
  latency: runLatencyCheck,
  contracts: runContractsCheck,
  permissions: runPermissionsCheck,
};

export const diagnosticsService = {
  async check() {
    const [database, redis, videoPipeline] = await Promise.all([checkDatabase(), checkRedis(), checkVideoPipeline()]);

    return {
      status: [database.status, redis.status].includes("error") ? "degraded" : videoPipeline.status === "warning" ? "warning" : "ok",
      checked_at: new Date().toISOString(),
      services: {
        database,
        redis,
        storage: checkStorage(),
        openai: checkOpenAI(),
        worker: {
          status: videoPipeline.status,
          command: "npm run worker:video",
          message: videoPipeline.message,
          active_count: videoPipeline.active_count,
          stale_count: videoPipeline.stale_count,
          failed_last_hour: videoPipeline.failed_last_hour,
        },
      },
    };
  },

  async runChecks(payload: RunChecksPayload = {}, user?: DiagnosticUser) {
    const requestedChecks = payload.checks?.length ? payload.checks : [...availableChecks];
    const safeChecks = requestedChecks.filter((check) => check in checkRunners);
    const results = await Promise.all(safeChecks.map((check) => checkRunners[check](user)));
    const status = results.some((result) => result.status === "error") ? "error" : results.some((result) => result.status === "warning") ? "warning" : "ok";

    return {
      status,
      checked_at: new Date().toISOString(),
      results,
      available_checks: availableChecks,
    };
  },

  async productionChecklist() {
    const [database, redis, videoPipeline] = await Promise.all([checkDatabase(), checkRedis(), checkVideoPipeline()]);
    const storage = checkStorage();
    const backupAgeHours = latestDirectoryAgeHours(backupsDir());
    const hasHttpsApi = env.API_PUBLIC_URL.startsWith("https://");
    const hasHttpsFrontend = env.FRONTEND_URL.startsWith("https://");

    const checks = [
      item("api", "API saudável", database.status === "error" ? "error" : "ok", database.status === "error" ? database.message || "Banco indisponível." : "API com banco respondendo."),
      item("redis", "Redis/BullMQ", redis.status === "error" ? "error" : "ok", redis.status === "error" ? redis.message || "Redis indisponível." : "Fila respondeu corretamente."),
      item("storage", "Storage persistente", storage.status as CheckStatus, storage.status === "ok" ? `Driver ${storage.driver} configurado.` : "Storage precisa de revisão antes de produção forte."),
      item("worker", "Worker de vídeo", videoPipeline.status, videoPipeline.message),
      item("backup", "Backup recente", backupAgeHours === null ? "warning" : backupAgeHours > 30 ? "warning" : "ok", backupAgeHours === null ? "Nenhum backup completo encontrado." : `Backup mais recente há ${backupAgeHours.toFixed(1)}h.`),
      item("openai", "OpenAI", env.OPENAI_API_KEY ? "ok" : "warning", env.OPENAI_API_KEY ? `Modelo de imagem: ${env.OPENAI_IMAGE_MODEL}.` : "OPENAI_API_KEY ausente."),
      item("ai_video", "Vídeo IA", env.AI_VIDEO_PROVIDER === "replicate_kling" && !env.REPLICATE_API_TOKEN ? "warning" : "ok", env.AI_VIDEO_PROVIDER === "replicate_kling" ? `Provider ${env.AI_VIDEO_PROVIDER}, modelo ${env.REPLICATE_KLING_MODEL}.` : "Renderização local FFmpeg ativa."),
      item("https_api", "API pública HTTPS", hasHttpsApi ? "ok" : "warning", hasHttpsApi ? env.API_PUBLIC_URL : "Configure domínio/tunnel HTTPS antes de uso externo real."),
      item("https_frontend", "Frontend HTTPS", hasHttpsFrontend ? "ok" : "warning", hasHttpsFrontend ? env.FRONTEND_URL : "FRONTEND_URL deve ser HTTPS em produção."),
      item("social", "Integrações sociais", env.SOCIAL_INTEGRATIONS_MODE === "live" ? "warning" : "ok", env.SOCIAL_INTEGRATIONS_MODE === "live" ? "Modo live ativo; confirme credenciais e permissões." : "Modo mock seguro para testes."),
      item("secrets", "Secrets operacionais", env.JWT_SECRET === "change-me-in-production" ? "error" : "ok", env.JWT_SECRET === "change-me-in-production" ? "JWT_SECRET precisa ser trocado." : "JWT_SECRET não usa o padrão inseguro."),
    ];

    return {
      status: checks.some((check) => check.status === "error") ? "error" : checks.some((check) => check.status === "warning") ? "warning" : "ok",
      checked_at: new Date().toISOString(),
      checks,
    };
  },

  operationalLogs() {
    const directory = logsDir();
    if (!existsSync(directory)) {
      return {
        status: "warning",
        directory,
        logs: [],
        message: "Diretório de logs ainda não existe.",
      };
    }

    const allowedFiles = ["deploy-last.log", "health-monitor.log", "backup.log"];
    const logs = allowedFiles
      .map((file) => {
        const filePath = join(directory, file);
        if (!existsSync(filePath)) return null;
        const content = readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean).slice(-60);
        return {
          file,
          updated_at: statSync(filePath).mtime.toISOString(),
          lines: content,
        };
      })
      .filter(Boolean);

    return {
      status: logs.length ? "ok" : "warning",
      directory,
      logs,
      message: logs.length ? "Logs operacionais carregados." : "Nenhum log operacional encontrado.",
    };
  },
};
