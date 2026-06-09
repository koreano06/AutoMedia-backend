import { prisma } from "../../database/prisma.js";
import { env } from "../../config/env.js";
import { getQueueConnection } from "../../queue/queue.client.js";

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

const availableChecks = ["auth", "database_write", "storage", "queue", "ai", "mock_publish", "latency", "contracts", "permissions"] as const;

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
  return { status: env.OPENAI_API_KEY ? "ok" : "warning", image_model: env.OPENAI_IMAGE_MODEL };
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
    const job = await prisma.job.create({
      data: {
        workspaceId: user?.workspace_id,
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
      metadata: { workspace_id: user?.workspace_id || null },
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
    },
  }));
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
  mock_publish: runMockPublishCheck,
  latency: runLatencyCheck,
  contracts: runContractsCheck,
  permissions: runPermissionsCheck,
};

export const diagnosticsService = {
  async check() {
    const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);

    return {
      status: [database.status, redis.status].includes("error") ? "degraded" : "ok",
      checked_at: new Date().toISOString(),
      services: {
        database,
        redis,
        storage: checkStorage(),
        openai: checkOpenAI(),
        worker: {
          status: "external",
          command: "npm run worker:video",
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
};
