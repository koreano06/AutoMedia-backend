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
  estimated_cost_usd: number;
};

type RecentVideoUsage = {
  id: string;
  title: string | null;
  product_name: string | null;
  status: string;
  provider: string;
  model?: string;
  duration_seconds: number | null;
  estimated_cost_usd: number;
  cost_source: "configured_estimate" | "free_local" | "unknown";
  url: string | null;
  created_at: string;
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

function estimatedVideoCost(provider: string, durationSeconds: number | null) {
  if (provider === "replicate_kling") {
    const cost = durationSeconds && durationSeconds > 5
      ? env.AI_VIDEO_COST_REPLICATE_KLING_10S_USD
      : env.AI_VIDEO_COST_REPLICATE_KLING_5S_USD;

    return {
      cost,
      source: "configured_estimate" as const,
    };
  }

  if (provider === "ffmpeg" || provider === "ffmpeg_fallback") {
    return {
      cost: env.AI_VIDEO_COST_FFMPEG_USD,
      source: "free_local" as const,
    };
  }

  return {
    cost: 0,
    source: "unknown" as const,
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
    estimated_cost_usd: 0,
  };
  map.set(key, created);
  return created;
}

async function usageForPeriod(workspaceId: string | undefined, since: Date) {
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
    const durationSeconds = durationFromMedia(asset);
    const estimatedCost = estimatedVideoCost(info.provider, durationSeconds);
    usage.videos += 1;
    usage.estimated_cost_usd += estimatedCost.cost;
  }

  const completed = jobs.filter((job) => job.status === "completed").length;
  const failed = jobs.filter((job) => job.status === "failed").length;
  const fallback = jobs.filter((job) => Boolean(readRecord(job.payload).ai_video_fallback_reason)).length;
  const providerList = [...providers.values()]
    .map((provider) => ({
      ...provider,
      estimated_cost_usd: Number(provider.estimated_cost_usd.toFixed(4)),
    }))
    .sort((a, b) => b.requests + b.videos - (a.requests + a.videos));

  const recentVideos: RecentVideoUsage[] = mediaAssets.slice(0, 20).map((asset) => {
    const info = providerFromMedia(asset);
    const durationSeconds = durationFromMedia(asset);
    const estimatedCost = estimatedVideoCost(info.provider, durationSeconds);

    return {
      id: asset.id,
      title: asset.title,
      product_name: asset.productName,
      status: asset.status,
      provider: info.provider,
      model: info.model,
      duration_seconds: durationSeconds,
      estimated_cost_usd: Number(estimatedCost.cost.toFixed(4)),
      cost_source: estimatedCost.source,
      url: asset.url,
      created_at: asset.createdAt.toISOString(),
    };
  });
  const estimatedCostTotal = providerList.reduce((sum, provider) => sum + provider.estimated_cost_usd, 0);

  return {
    since: since.toISOString(),
    jobs: jobs.length,
    completed,
    failed,
    fallback,
    videos: mediaAssets.length,
    estimated_cost_usd: Number(estimatedCostTotal.toFixed(4)),
    providers: providerList,
    recent_videos: recentVideos,
  };
}

export const aiUsageService = {
  async summary(workspaceId?: string) {
    const [day, week, month] = await Promise.all([
      usageForPeriod(workspaceId, periodStart("day")),
      usageForPeriod(workspaceId, periodStart("week")),
      usageForPeriod(workspaceId, periodStart("month")),
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
          credit_status: "manual",
          credit_message: "A API usada no projeto não expõe saldo de créditos de forma confiável. Consulte o painel da OpenAI.",
        },
        {
          id: "replicate_kling",
          name: "Replicate/Kling",
          configured: Boolean(env.REPLICATE_API_TOKEN),
          video_model: env.REPLICATE_KLING_MODEL,
          mode: env.REPLICATE_KLING_MODE,
          credit_status: "manual",
          credit_message: "Consulte saldo e cobranças no painel da Replicate.",
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
