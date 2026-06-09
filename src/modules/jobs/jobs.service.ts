import { jobsRepository } from "./jobs.repository.js";
import { mediaRepository } from "../media/media.repository.js";
import { productsRepository } from "../products/products.repository.js";
import { enqueueVideoGeneration, type VideoRenderPlan } from "../videos/video-generation.queue.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { Job, MediaAsset } from "../../shared/types/domain.js";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function readRenderPlan(value: unknown): VideoRenderPlan | undefined {
  if (!isObject(value)) return undefined;
  const scenes = value.scenes;
  if (!Array.isArray(scenes)) return undefined;
  return value as unknown as VideoRenderPlan;
}

function extractAssetId(job: Job) {
  return job.media_asset_id
    || readString(job.result?.asset_id)
    || readString(job.payload?.asset_id);
}

function extractRenderPlan(job: Job, asset: MediaAsset) {
  const assetPlan = readRenderPlan(asset.metadata?.render_plan);
  if (assetPlan) return assetPlan;

  return readRenderPlan(job.payload?.render_plan);
}

function extractMediaUrls(plan?: VideoRenderPlan, asset?: MediaAsset) {
  const sceneSources = plan?.scenes?.map((scene) => scene.source).filter(Boolean) || [];
  return [...sceneSources, asset?.thumbnail_url, asset?.url].filter(Boolean) as string[];
}

export const jobsService = {
  list(workspaceId?: string) {
    if (workspaceId) return jobsRepository.filter({ workspace_id: workspaceId }, "-created_at", 100);
    return jobsRepository.list("-created_at", 100);
  },

  async get(id: string, workspaceId?: string) {
    const job = await jobsRepository.findById(id);
    if (!job) throw new AppError("Job não encontrado", 404, "JOB_NOT_FOUND");
    if (workspaceId && job.workspace_id && job.workspace_id !== workspaceId) throw new AppError("Job não pertence a este workspace", 403, "WORKSPACE_FORBIDDEN");
    return job;
  },

  create(payload: Partial<Job>, workspaceId?: string) {
    return jobsRepository.create({ status: "queued", progress: 0, workspace_id: workspaceId, ...payload });
  },

  async update(id: string, payload: Partial<Job>, workspaceId?: string) {
    const job = await jobsRepository.findById(id);
    if (!job) throw new AppError("Job não encontrado", 404, "JOB_NOT_FOUND");
    if (workspaceId && job.workspace_id && job.workspace_id !== workspaceId) throw new AppError("Job não pertence a este workspace", 403, "WORKSPACE_FORBIDDEN");
    return jobsRepository.update(id, payload);
  },

  async delete(id: string, workspaceId?: string) {
    const job = await jobsRepository.findById(id);
    if (!job) throw new AppError("Job não encontrado", 404, "JOB_NOT_FOUND");
    if (workspaceId && job.workspace_id && job.workspace_id !== workspaceId) throw new AppError("Job não pertence a este workspace", 403, "WORKSPACE_FORBIDDEN");
    return jobsRepository.delete(id);
  },

  async retry(id: string, workspaceId?: string) {
    const job = await jobsRepository.findById(id);
    if (!job) throw new AppError("Job não encontrado", 404, "JOB_NOT_FOUND");
    if (workspaceId && job.workspace_id && job.workspace_id !== workspaceId) throw new AppError("Job não pertence a este workspace", 403, "WORKSPACE_FORBIDDEN");
    if (job.type !== "video_generation") throw new AppError("Retry automático disponível apenas para geração de vídeo", 409, "JOB_RETRY_UNSUPPORTED");
    if (!["failed", "cancelled"].includes(job.status)) throw new AppError("Apenas jobs falhos ou cancelados podem ser reenfileirados", 409, "JOB_RETRY_INVALID_STATUS");

    const assetId = extractAssetId(job);
    if (!assetId) throw new AppError("Job não possui mídia vinculada para retry", 409, "JOB_RETRY_ASSET_MISSING");

    const asset = await mediaRepository.findById(assetId);
    if (!asset) throw new AppError("Mídia vinculada ao job não foi encontrada", 404, "JOB_RETRY_ASSET_NOT_FOUND");
    if (workspaceId && asset.workspace_id && asset.workspace_id !== workspaceId) throw new AppError("Mídia não pertence a este workspace", 403, "WORKSPACE_FORBIDDEN");

    const product = asset.product_id ? await productsRepository.findById(asset.product_id) : null;
    const renderPlan = extractRenderPlan(job, asset);
    const mediaUrls = extractMediaUrls(renderPlan, asset);

    await mediaRepository.update(asset.id, {
      status: "generating",
      review_notes: "",
    });

    const queuedJob = await jobsRepository.update(job.id, {
      status: "processing",
      progress: 15,
      error_message: "",
      payload: {
        ...(job.payload || {}),
        retry_requested_at: new Date().toISOString(),
      },
    });

    await enqueueVideoGeneration({
      job_id: job.id,
      asset_id: asset.id,
      product_name: product?.name || asset.product_name || readString(job.payload?.product_name),
      source_url: mediaUrls[0],
      media_urls: mediaUrls,
      render_plan: renderPlan,
      script: asset.caption || readString(job.payload?.script),
      duration: asset.duration || readString(job.payload?.duration) || renderPlan?.duration,
      ratio: readString(job.payload?.ratio) || renderPlan?.ratio || "9:16",
    });

    return queuedJob;
  },
};
