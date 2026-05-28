import { Worker } from "bullmq";
import { getQueueConnection } from "../../queue/queue.client.js";
import { jobsRepository } from "../jobs/jobs.repository.js";
import { mediaRepository } from "../media/media.repository.js";
import { storageService } from "../../integrations/storage/storage.service.js";
import { videoRendererService } from "../../integrations/video-rendering/video-renderer.service.js";
import { VIDEO_GENERATION_QUEUE, type VideoGenerationQueuePayload } from "./video-generation.queue.js";

export function startVideoGenerationWorker() {
  const worker = new Worker<VideoGenerationQueuePayload>(
    VIDEO_GENERATION_QUEUE,
    async (job) => {
      const payload = job.data;
      const asset = await mediaRepository.findById(payload.asset_id);

      await jobsRepository.update(payload.job_id, {
        status: "rendering",
        progress: 35,
        payload,
      });

      await mediaRepository.update(payload.asset_id, {
        status: "generating",
      });

      const rendered = await videoRendererService.render({
        jobId: payload.job_id,
        assetId: payload.asset_id,
        sourceUrl: payload.source_url || asset?.thumbnail_url || asset?.url,
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

  return worker;
}
