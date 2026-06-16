import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";

type ProviderUsage = {
  provider: string;
  model?: string;
  requests: number;
  completed: number;
  failed: number;
  fallback: number;
  videos: number;
  official_cost_usd: number | null;
  cost_source: "official_api" | "free_local" | "unavailable";
};

type RecentVideoUsage = {
  id: string;
  title: string | null;
  product_name: string | null;
  status: string;
  provider: string;
  model?: string;
  duration_seconds: number | null;
  official_cost_usd: number | null;
  cost_source: "official_api" | "free_local" | "unavailable";
  cost_message: string;
  url: string | null;
  created_at: string;
};

type OfficialBilling = {
  openai_cost_usd: number | null;
  openai_status: "available" | "not_configured" | "error";
  openai_message: string;
};

function periodStart(kind: "day" | "week" | "month") {
  const now = new Date();
  const start = new Date(now);

  if (kind === "day") {
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (kind === "week") {
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", ".").replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function providerFromJob(job: { result: unknown; payload: unknown }) {
  const result = readRecord(job.result);
  const payload = readRecord(job.payload);
  const provider = readString(result.ai_video_provider)
    || readString(payload.ai_video_provider)
    || (readString(payload.ai_video_fallback_reason) ? "ffmpeg_fallback" : "ffmpeg");

  return {
    provider,
    model: readString(result.ai_video_model) || readString(payload.ai_video_model),
    fallback: Boolean(payload.ai_video_fallback_reason),
  };
}

function providerFromMedia(asset: { source: string | null; metadata: unknown }) {
  const metadata = readRecord(asset.metadata);
  const aiVideo = readRecord(metadata.ai_video);
  const provider = readString(aiVideo.provider)
    || readString(metadata.ai_video_provider)
    || (asset.source?.toLowerCase().includes("replicate") ? "replicate_kling" : undefined)
    || (asset.source?.toLowerCase().includes("ffmpeg") ? "ffmpeg" : undefined)
    || "unknown";

  return {
    provider,
    model: readString(aiVideo.model) || readString(metadata.ai_video_model),
  };
}

function durationFromMedia(asset: { duration: string | null; metadata: unknown }) {
  const metadata = readRecord(asset.metadata);
  const aiVideo = readRecord(metadata.ai_video);
  const duration = readNumber(aiVideo.duration_seconds)
    || readNumber(aiVideo.duration)
    || readNumber(metadata.duration_seconds)
    || readNumber(asset.duration);

  return duration ? Math.round(duration) : null;
}

function officialVideoCost(provider: string) {
  if (provider === "ffmpeg" || provider === "ffmpeg_fallback") {
    return {
      cost: 0,
      source: "free_local" as const,
      message: "Render local com FFmpeg, sem custo de API externa.",
    };
  }

  return {
    cost: null,
    source: "unavailable" as const,
    message: "Custo oficial por video ainda nao disponivel pela API conectada.",
  };
}

function upsertProvider(map: Map<string, ProviderUsage>, provider: string, model?: string) {
  const key = `${provider}:${model || "default"}`;
  const current = map.get(key);
  if (current) return current;

  const created: ProviderUsage = {
    provider,
    model,
    requests: 0,
    completed: 0,
    failed: 0,
    fallback: 0,
    videos: 0,
    official_cost_usd: null,
    cost_source: provider === "ffmpeg" || provider === "ffmpeg_fallback" ? "free_local" : "unavailable",
  };
  map.set(key, created);
  return created;
}

async function fetchOpenAICosts(since: Date): Promise<OfficialBilling> {
  const apiKey = env.OPENAI_ADMIN_API_KEY;
  if (!apiKey) {
    return {
      openai_cost_usd: null,
      openai_status: "not_configured",
      openai_message: "OPENAI_ADMIN_API_KEY nao configurada. Custos oficiais da OpenAI indisponiveis.",
    };
  }

  const url = new URL("https://api.openai.com/v1/organization/costs");
  url.searchParams.set("start_time", String(Math.floor(since.getTime() / 1000)));
  url.searchParams.set("end_time", String(Math.floor(Date.now() / 1000)));
  url.searchParams.set("bucket_width", "1d");
  url.searchParams.set("limit", "180");

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return {
        openai_cost_usd: null,
        openai_status: "error",
        openai_message: `OpenAI Costs API retornou status ${response.status}. Verifique se a chave e admin da organizacao.`,
      };
    }

    const payload = await response.json() as { data?: Array<{ results?: Array<{ amount?: { currency?: string; value?: number } }> }> };
    const total = (payload.data || []).reduce((bucketSum, bucket) => {
      const resultSum = (bucket.results || []).reduce((sum, result) => {
        if (result.amount?.currency && result.amount.currency !== "usd") return sum;
        return sum + (typeof result.amount?.value === "number" ? result.amount.value : 0);
      }, 0);

      return bucketSum + resultSum;
    }, 0);

    return {
      openai_cost_usd: Number(total.toFixed(6)),
      openai_status: "available",
      openai_message: "Custo oficial retornado pela OpenAI Costs API.",
    };
  } catch {
    return {
      openai_cost_usd: null,
      openai_status: "error",
      openai_message: "Nao foi possivel consultar a OpenAI Costs API neste momento.",
    };
  }
}

async function usageForPeriod(workspaceId: string | undefined, since: Date, billing: OfficialBilling) {
  const where = {
    ...(workspaceId ? { workspaceId } : {}),
    createdAt: { gte: since },
  };

  const [jobs, mediaAssets] = await Promise.all([
    prisma.job.findMany({
      where: {
        ...where,
        type: "video_generation",
      },
      select: {
        id: true,
        status: true,
        result: true,
        payload: true,
        resultUrl: true,
        createdAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    prisma.mediaAsset.findMany({
      where: {
        ...where,
        type: "generated_video",
      },
      select: {
        id: true,
        status: true,
        source: true,
        metadata: true,
        url: true,
        title: true,
        productName: true,
        duration: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
  ]);

  const providers = new Map<string, ProviderUsage>();

  for (const job of jobs) {
    const info = providerFromJob(job);
    const usage = upsertProvider(providers, info.provider, info.model);
    usage.requests += 1;
    if (job.status === "completed") usage.completed += 1;
    if (job.status === "failed") usage.failed += 1;
    if (info.fallback) usage.fallback += 1;
  }

  for (const asset of mediaAssets) {
    const info = providerFromMedia(asset);
    const usage = upsertProvider(providers, info.provider, info.model);
    const cost = officialVideoCost(info.provider);
    usage.videos += 1;
    if (cost.source === "free_local") {
      usage.official_cost_usd = 0;
      usage.cost_source = "free_local";
    }
  }

  if (providers.has(`openai:${env.OPENAI_TEXT_MODEL}`) || billing.openai_cost_usd !== null) {
    const openaiUsage = upsertProvider(providers, "openai", env.OPENAI_TEXT_MODEL);
    openaiUsage.official_cost_usd = billing.openai_cost_usd;
    openaiUsage.cost_source = billing.openai_status === "available" ? "official_api" : "unavailable";
  }

  const completed = jobs.filter((job) => job.status === "completed").length;
  const failed = jobs.filter((job) => job.status === "failed").length;
  const fallback = jobs.filter((job) => Boolean(readRecord(job.payload).ai_video_fallback_reason)).length;
  const providerList = [...providers.values()]
    .sort((a, b) => b.requests + b.videos - (a.requests + a.videos));

  const recentVideos: RecentVideoUsage[] = mediaAssets.slice(0, 20).map((asset) => {
    const info = providerFromMedia(asset);
    const durationSeconds = durationFromMedia(asset);
    const officialCost = officialVideoCost(info.provider);

    return {
      id: asset.id,
      title: asset.title,
      product_name: asset.productName,
      status: asset.status,
      provider: info.provider,
      model: info.model,
      duration_seconds: durationSeconds,
      official_cost_usd: officialCost.cost,
      cost_source: officialCost.source,
      cost_message: officialCost.message,
      url: asset.url,
      created_at: asset.createdAt.toISOString(),
    };
  });
  const officialCostTotal = providerList.reduce((sum, provider) => sum + (provider.official_cost_usd || 0), 0);

  return {
    since: since.toISOString(),
    jobs: jobs.length,
    completed,
    failed,
    fallback,
    videos: mediaAssets.length,
    official_cost_usd: Number(officialCostTotal.toFixed(6)),
    billing_status: {
      openai: billing.openai_status,
      openai_message: billing.openai_message,
      replicate: "unavailable",
      replicate_message: "A Replicate nao expoe custo oficial consolidado no fluxo atual; videos mostram uso real, mas custo fica indisponivel.",
    },
    providers: providerList,
    recent_videos: recentVideos,
  };
}

export const aiUsageService = {
  async summary(workspaceId?: string) {
    const dayStart = periodStart("day");
    const weekStart = periodStart("week");
    const monthStart = periodStart("month");
    const [dayBilling, weekBilling, monthBilling] = await Promise.all([
      fetchOpenAICosts(dayStart),
      fetchOpenAICosts(weekStart),
      fetchOpenAICosts(monthStart),
    ]);
    const [day, week, month] = await Promise.all([
      usageForPeriod(workspaceId, dayStart, dayBilling),
      usageForPeriod(workspaceId, weekStart, weekBilling),
      usageForPeriod(workspaceId, monthStart, monthBilling),
    ]);

    return {
      generated_at: new Date().toISOString(),
      providers: [
        {
          id: "openai",
          name: "OpenAI",
          configured: Boolean(env.OPENAI_API_KEY),
          text_model: env.OPENAI_TEXT_MODEL,
          image_model: env.OPENAI_IMAGE_MODEL,
          credit_status: monthBilling.openai_status,
          credit_message: monthBilling.openai_message,
        },
        {
          id: "replicate_kling",
          name: "Replicate/Kling",
          configured: Boolean(env.REPLICATE_API_TOKEN),
          video_model: env.REPLICATE_KLING_MODEL,
          mode: env.REPLICATE_KLING_MODE,
          credit_status: "unavailable",
          credit_message: "Uso operacional real disponivel. Custo oficial consolidado nao esta disponivel via API no fluxo atual.",
        },
      ],
      periods: {
        day,
        week,
        month,
      },
    };
  },
};
