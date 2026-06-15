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
        payload,
      });

      await mediaRepository.update(payload.asset_id, {
        status: "generating",
      });

      if (aiVideoService.shouldUseExternalProvider()) {
        try {
          await jobsRepository.update(payload.job_id, {
            status: "rendering",
            progress: 45,
            payload: {
              ...payload,
              ai_video_stage: "external_generation",
            },
          });

          const aiVideo = await aiVideoService.generate({
            assetId: payload.asset_id,
            jobId: payload.job_id,
            productName: payload.product_name,
            startImageUrl: payload.source_url || payload.media_urls?.[0] || asset?.thumbnail_url || asset?.url,
            prompt: payload.ai_prompt || payload.script || payload.render_plan?.script || "",
            duration: payload.duration,
            ratio: payload.ratio,
            renderPlan: payload.render_plan,
          });

          await jobsRepository.update(payload.job_id, {
            status: "uploading",
            progress: 86,
          });

          const upload = await storageService.cacheRemoteMedia({
            url: aiVideo.output_url,
            keyPrefix: `rendered-videos/${payload.asset_id}`,
            fallbackName: `${payload.asset_id}.mp4`,
          });

          const updatedAsset = await mediaRepository.update(payload.asset_id, {
            status: "pending_review",
            source: "Replicate Kling AI",
            url: upload.url,
            storage_key: upload.storage_key,
            mime_type: upload.content_type || "video/mp4",
            file_size: upload.size,
            duration: String(aiVideo.duration_seconds || payload.duration || ""),
            quality_score: 90,
            metadata: {
              ...(asset.metadata && typeof asset.metadata === "object" ? asset.metadata : {}),
              ai_video: {
                provider: aiVideo.provider,
                model: aiVideo.model,
                prediction_id: aiVideo.prediction_id,
                remote_output_url: aiVideo.output_url,
                metadata: aiVideo.metadata || {},
              },
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
              ai_video_provider: aiVideo.provider,
              ai_video_model: aiVideo.model,
              prediction_id: aiVideo.prediction_id,
            },
          });

          return { asset_id: updatedAsset.id, url: upload.url, ai_video_provider: aiVideo.provider };
        } catch (error) {
          if (!aiVideoService.shouldFallbackToFfmpeg(error)) throw error;

          await jobsRepository.update(payload.job_id, {
            status: "rendering",
            progress: 40,
            payload: {
              ...payload,
              ai_video_fallback_reason: error instanceof Error ? error.message : "Falha no provedor externo de vídeo IA",
            },
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
  });

  worker.on("stalled", async (jobId) => {
    console.warn(`[video-worker] Job ${jobId} ficou travado e sera reenfileirado pelo BullMQ.`);
  });

  worker.on("error", (error) => {
    console.error("[video-worker] Erro interno do worker:", error);
  });

  return worker;
}
