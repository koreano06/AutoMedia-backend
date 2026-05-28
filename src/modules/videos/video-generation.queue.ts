import { enqueueJob } from "../../queue/queue.client.js";

export const VIDEO_GENERATION_QUEUE = "video_generation";

export type VideoGenerationQueuePayload = {
  job_id: string;
  asset_id: string;
  source_url?: string;
  duration?: string | number;
  ratio?: string;
};

export async function enqueueVideoGeneration(payload: VideoGenerationQueuePayload) {
  await enqueueJob(VIDEO_GENERATION_QUEUE, "render-video", payload, {
    jobId: payload.job_id,
  });
}
