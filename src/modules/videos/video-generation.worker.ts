import { Worker } from "bullmq";
import { unlink } from "node:fs/promises";
import { getQueueConnection } from "../../queue/queue.client.js";
import { jobsRepository } from "../jobs/jobs.repository.js";
import { mediaRepository } from "../media/media.repository.js";
import { aiVideoService } from "../../integrations/ai-video/ai-video.service.js";
import { storageService } from "../../integrations/storage/storage.service.js";
import { videoRendererService } from "../../integrations/video-rendering/video-renderer.service.js";
import { VIDEO_GENERATION_QUEUE, type VideoGenerationQueuePayload } from "./video-generation.queue.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { AIVideoResult } from "../../integrations/ai-video/ai-video.types.js";
import type { VideoRenderPlan, VideoRenderScene } from "./video-generation.queue.js";
import { auditService } from "../audit/audit.service.js";

function secondsFromDuration(duration?: string | number) {
  if (typeof duration === "number") return Math.max(5, duration);
  const match = String(duration || "10s").match(/\d+/);
  return Math.max(5, Number(match?.[0] || 10));
}

function splitDurationIntoSegments(totalSeconds: number) {
  const segments: number[] = [];
  let remaining = totalSeconds;

  while (remaining > 0) {
    const next = Math.min(10, remaining);
    segments.push(next);
    remaining -= next;
  }

  return segments;
}

function compactText(value?: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function sceneSummary(scene: VideoRenderScene) {
  return [
    `${scene.order}. ${scene.type}`,
    scene.headline,
    scene.subheadline,
    scene.instruction,
  ].filter(Boolean).join(" - ");
}

function scenesForSegment(renderPlan: VideoRenderPlan | undefined, segmentIndex: number, totalSegments: number) {
  const scenes = renderPlan?.scenes || [];
  if (!scenes.length) return [];

  const segmentSize = Math.ceil(scenes.length / totalSegments);
  const start = segmentIndex * segmentSize;
  const selected = scenes.slice(start, start + segmentSize);

  return selected.length ? selected : scenes.slice(-1);
}

function buildSegmentPrompt(input: {
  renderPlan?: VideoRenderPlan;
  basePrompt?: string;
  segmentIndex: number;
  totalSegments: number;
  segmentSeconds: number;
}) {
  const segmentNumber = input.segmentIndex + 1;
  const selectedScenes = scenesForSegment(input.renderPlan, input.segmentIndex, input.totalSegments);
  const sceneText = selectedScenes.map(sceneSummary).join(" | ");
  const basePrompt = compactText(input.basePrompt || input.renderPlan?.script);
  const continuityInstruction = input.totalSegments > 1
    ? `This is segment ${segmentNumber} of ${input.totalSegments} of the same final video. Keep the same product, environment, lighting, hands, camera style and visual identity.`
    : "This is the full video.";
  const openingInstruction = segmentNumber === 1
    ? "Start with the hook and product reveal. Do not show the final CTA yet unless this is the only segment."
    : "Continue naturally from the previous segment. Do not repeat the opening unboxing unless it is needed for continuity.";
  const closingInstruction = segmentNumber === input.totalSegments
    ? "End this segment with the final CTA and a clear product beauty shot."
    : "End this segment with a visual bridge that can cut smoothly into the next segment. Do not use final CTA.";

  return [
    continuityInstruction,
    `Generate only ${input.segmentSeconds} seconds for this segment.`,
    openingInstruction,
    closingInstruction,
    selectedScenes.length ? `Scenes to cover in this segment: ${sceneText}.` : "",
    "The final platform will concatenate all segments, so each segment must look like part of one continuous product ad.",
    basePrompt,
  ].filter(Boolean).join("\n\n");
}

function segmentRenderPlan(renderPlan: VideoRenderPlan | undefined, segmentIndex: number, totalSegments: number, segmentSeconds: number): VideoRenderPlan | undefined {
  if (!renderPlan) return undefined;

  const selectedScenes = scenesForSegment(renderPlan, segmentIndex, totalSegments);
  return {
    ...renderPlan,
    duration: `${segmentSeconds}s`,
    scenes: selectedScenes.length ? selectedScenes : renderPlan.scenes,
    script: buildSegmentPrompt({
      renderPlan,
      basePrompt: renderPlan.script,
      segmentIndex,
      totalSegments,
      segmentSeconds,
    }),
  };
}

function withPayloadStage(payload: VideoGenerationQueuePayload, stage: string, extra: Record<string, unknown> = {}) {
  return {
    ...payload,
    ai_video_stage: stage,
    ...extra,
  };
}

function buildCostRecord(input: {
  payload: VideoGenerationQueuePayload;
  provider: string;
  model?: string;
  segments: number;
  durationSeconds: number;
  fallback?: boolean;
}) {
  const estimate = input.payload.cost_estimate;
  const estimatedCost = estimate?.estimated_cost_usd ?? 0;

  return {
    provider: input.provider,
    model: input.model || estimate?.model,
    currency: estimate?.currency || "USD",
    estimated_cost_usd: estimatedCost,
    estimated_cost_per_segment_usd: estimate?.estimated_cost_per_segment_usd ?? 0,
    duration_seconds: input.durationSeconds,
    segments: input.segments,
    fallback: Boolean(input.fallback),
    source: estimatedCost > 0 ? estimate?.source || "configured_estimate" : "not_configured",
  };
}

export function startVideoGenerationWorker() {
  const worker = new Worker<VideoGenerationQueuePayload>(
    VIDEO_GENERATION_QUEUE,
    async (job) => {
      const payload = job.data;
      const asset = await mediaRepository.findById(payload.asset_id);
      if (!asset) {
        throw new AppError("Midia de video nao encontrada para renderizacao", 404, "VIDEO_ASSET_NOT_FOUND");
      }

      await jobsRepository.update(payload.job_id, {
        status: "rendering",
        progress: 35,
        payload: withPayloadStage(payload, "creating_scene_plan"),
      });

      await mediaRepository.update(payload.asset_id, {
        status: "generating",
      });

      if (aiVideoService.shouldUseExternalProvider()) {
        try {
          await jobsRepository.update(payload.job_id, {
            status: "rendering",
              progress: 45,
            payload: withPayloadStage(payload, "external_generation"),
          });

          const requestedSeconds = secondsFromDuration(payload.duration);
          const segmentDurations = requestedSeconds > 10 ? splitDurationIntoSegments(requestedSeconds) : [requestedSeconds];
          const aiVideos: AIVideoResult[] = [];

          for (const [index, segmentSeconds] of segmentDurations.entries()) {
            const segmentProgress = 45 + Math.round((index / segmentDurations.length) * 30);
            await jobsRepository.update(payload.job_id, {
              status: "rendering",
              progress: segmentProgress,
              payload: withPayloadStage(payload, "external_generation", {
                ai_video_segments_total: segmentDurations.length,
                ai_video_segment_current: index + 1,
                ai_video_segment_label: `Gerando segmento ${index + 1}/${segmentDurations.length}`,
              }),
            });

            const aiVideo = await aiVideoService.generate({
              assetId: payload.asset_id,
              jobId: payload.job_id,
              productName: payload.product_name,
              startImageUrl: payload.source_url || payload.media_urls?.[0] || asset?.thumbnail_url || asset?.url,
              prompt: buildSegmentPrompt({
                renderPlan: payload.render_plan,
                basePrompt: payload.ai_prompt || payload.script || payload.render_plan?.script,
                segmentIndex: index,
                totalSegments: segmentDurations.length,
                segmentSeconds,
              }),
              duration: `${segmentSeconds}s`,
              ratio: payload.ratio,
              renderPlan: segmentRenderPlan(payload.render_plan, index, segmentDurations.length, segmentSeconds),
            });

            aiVideos.push(aiVideo);
          }

          await jobsRepository.update(payload.job_id, {
            status: segmentDurations.length > 1 ? "rendering" : "uploading",
            progress: segmentDurations.length > 1 ? 82 : 86,
            payload: withPayloadStage(payload, segmentDurations.length > 1 ? "concatenating_segments" : "uploading_to_library", {
              ai_video_segments_total: segmentDurations.length,
            }),
          });

          const totalDuration = aiVideos.reduce((total, video) => total + (video.duration_seconds || 0), 0) || requestedSeconds;
          const upload = aiVideos.length > 1
            ? await (async () => {
              const rendered = await videoRendererService.concatAIVideoSegments({
                jobId: payload.job_id,
                assetId: payload.asset_id,
                urls: aiVideos.map((video) => video.output_url),
                ratio: payload.ratio,
                durationSeconds: totalDuration,
              });
              const stored = await storageService.uploadVideo({
                localPath: rendered.localPath,
                key: `rendered-videos/${payload.asset_id}.mp4`,
                contentType: rendered.mime_type,
              });
              await unlink(rendered.localPath).catch(() => undefined);
              return {
                ...stored,
                content_type: rendered.mime_type,
                size: undefined,
              };
            })()
            : await storageService.cacheRemoteMedia({
              url: aiVideos[0].output_url,
              keyPrefix: `rendered-videos/${payload.asset_id}`,
              fallbackName: `${payload.asset_id}.mp4`,
            });

          await jobsRepository.update(payload.job_id, {
            status: "uploading",
            progress: 90,
            payload: withPayloadStage(payload, "uploading_to_library", {
              ai_video_segments_total: segmentDurations.length,
            }),
          });

          const cost = buildCostRecord({
            payload,
            provider: aiVideos[0].provider,
            model: aiVideos[0].model,
            segments: aiVideos.length,
            durationSeconds: totalDuration,
          });

          const updatedAsset = await mediaRepository.update(payload.asset_id, {
            status: "pending_review",
            source: "Replicate Kling AI",
            url: upload.url,
            storage_key: upload.storage_key,
            mime_type: upload.content_type || "video/mp4",
            file_size: upload.size,
            duration: String(totalDuration || payload.duration || ""),
            quality_score: 90,
            metadata: {
              ...(asset.metadata && typeof asset.metadata === "object" ? asset.metadata : {}),
              ai_video: {
                provider: aiVideos[0].provider,
                model: aiVideos[0].model,
                cost,
                prediction_id: aiVideos.map((video) => video.prediction_id).filter(Boolean).join(","),
                remote_output_url: aiVideos.length === 1 ? aiVideos[0].output_url : undefined,
                segments: aiVideos.map((video, index) => ({
                  index: index + 1,
                  duration_seconds: video.duration_seconds,
                  prediction_id: video.prediction_id,
                  output_url: video.output_url,
                  metadata: video.metadata || {},
                })),
                requested_duration_seconds: requestedSeconds,
                final_duration_seconds: totalDuration,
                concatenated_with_ffmpeg: aiVideos.length > 1,
              },
              cost,
              scene_plan: payload.scene_plan || payload.render_plan,
            },
          });

          await jobsRepository.update(payload.job_id, {
            status: "completed",
            progress: 100,
            media_asset_id: payload.asset_id,
            result_url: upload.url,
            completed_at: new Date().toISOString(),
            result: {
              asset_id: payload.asset_id,
              storage_provider: upload.provider,
              url: upload.url,
              ai_video_provider: aiVideos[0].provider,
              ai_video_model: aiVideos[0].model,
              cost,
              prediction_id: aiVideos.map((video) => video.prediction_id).filter(Boolean).join(","),
              ai_video_segments: aiVideos.length,
              final_duration_seconds: totalDuration,
            },
          });

          await auditService.log({
            actor_id: payload.requested_by_user_id,
            action: "video.generate.completed",
            entity_type: "media_asset",
            entity_id: payload.asset_id,
            metadata: {
              job_id: payload.job_id,
              provider: aiVideos[0].provider,
              model: aiVideos[0].model,
              segments: aiVideos.length,
              duration_seconds: totalDuration,
              estimated_cost_usd: cost.estimated_cost_usd,
              fallback: false,
            },
          });

          return { asset_id: updatedAsset.id, url: upload.url, ai_video_provider: aiVideos[0].provider, segments: aiVideos.length };
        } catch (error) {
          if (!aiVideoService.shouldFallbackToFfmpeg(error)) throw error;

          await jobsRepository.update(payload.job_id, {
            status: "rendering",
            progress: 40,
            payload: withPayloadStage(payload, "fallback_ffmpeg", {
              ai_video_fallback_reason: error instanceof Error ? error.message : "Falha no provedor externo de vídeo IA",
            }),
          });
        }
      }

      const rendered = await videoRendererService.render({
        jobId: payload.job_id,
        assetId: payload.asset_id,
        productName: payload.product_name,
        sourceUrl: payload.source_url || asset?.thumbnail_url || asset?.url,
        mediaUrls: payload.media_urls,
        renderPlan: payload.render_plan,
        duration: payload.duration,
        ratio: payload.ratio,
      });

      await jobsRepository.update(payload.job_id, {
        status: "uploading",
        progress: 82,
        payload: withPayloadStage(payload, "uploading_to_library", {
          ai_video_fallback_reason: payload.cost_estimate?.provider === "replicate_kling" ? "Render finalizado pelo FFmpeg" : undefined,
        }),
      });

      if ("mock" in rendered && rendered.mock) {
        await jobsRepository.update(payload.job_id, {
          status: "completed",
          progress: 100,
          media_asset_id: payload.asset_id,
          result_url: asset?.url,
          completed_at: new Date().toISOString(),
          result: { mock: true, asset_id: payload.asset_id },
        });

        return { asset_id: payload.asset_id, mock: true };
      }

      const upload = await storageService.uploadVideo({
        localPath: rendered.localPath,
        key: `rendered-videos/${payload.asset_id}.mp4`,
        contentType: rendered.mime_type,
      });
      await unlink(rendered.localPath).catch(() => undefined);

      const updatedAsset = await mediaRepository.update(payload.asset_id, {
        status: "pending_review",
        source: "FFmpeg Render",
        url: upload.url,
        storage_key: upload.storage_key,
        mime_type: rendered.mime_type,
        duration: String(rendered.duration),
        quality_score: 86,
        metadata: {
          ...(asset.metadata && typeof asset.metadata === "object" ? asset.metadata : {}),
          cost: buildCostRecord({
            payload,
            provider: "ffmpeg",
            model: "ffmpeg",
            segments: 1,
            durationSeconds: Number(rendered.duration || secondsFromDuration(payload.duration)),
            fallback: Boolean(payload.cost_estimate?.provider === "replicate_kling"),
          }),
          scene_plan: payload.scene_plan || payload.render_plan,
        },
      });

      const fallbackCost = buildCostRecord({
        payload,
        provider: "ffmpeg",
        model: "ffmpeg",
        segments: 1,
        durationSeconds: Number(rendered.duration || secondsFromDuration(payload.duration)),
        fallback: Boolean(payload.cost_estimate?.provider === "replicate_kling"),
      });

      await jobsRepository.update(payload.job_id, {
        status: "completed",
        progress: 100,
        media_asset_id: payload.asset_id,
        result_url: upload.url,
        completed_at: new Date().toISOString(),
        result: {
          asset_id: payload.asset_id,
          storage_provider: upload.provider,
          url: upload.url,
          width: rendered.width,
          height: rendered.height,
          cost: fallbackCost,
          fallback: fallbackCost.fallback,
        },
      });

      await auditService.log({
        actor_id: payload.requested_by_user_id,
        action: "video.generate.completed",
        entity_type: "media_asset",
        entity_id: payload.asset_id,
        metadata: {
          job_id: payload.job_id,
          provider: "ffmpeg",
          duration_seconds: rendered.duration,
          fallback: fallbackCost.fallback,
          estimated_cost_usd: fallbackCost.estimated_cost_usd,
        },
      });

      return { asset_id: updatedAsset.id, url: upload.url };
    },
    { connection: getQueueConnection(), concurrency: 1 },
  );

  worker.on("failed", async (job, error) => {
    const payload = job?.data;
    if (!payload?.job_id || !payload?.asset_id) return;

    await jobsRepository.update(payload.job_id, {
      status: "failed",
      progress: 100,
      error_message: error.message,
    });

    await mediaRepository.update(payload.asset_id, {
      status: "failed",
      review_notes: error.message,
    });

    await auditService.log({
      actor_id: payload.requested_by_user_id,
      action: "video.generate.failed",
      entity_type: "job",
      entity_id: payload.job_id,
      metadata: {
        asset_id: payload.asset_id,
        error: error.message,
      },
    });
  });

  worker.on("stalled", async (jobId) => {
    console.warn(`[video-worker] Job ${jobId} ficou travado e sera reenfileirado pelo BullMQ.`);
  });

  worker.on("error", (error) => {
    console.error("[video-worker] Erro interno do worker:", error);
  });

  return worker;
}
