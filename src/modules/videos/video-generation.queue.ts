import { enqueueJob } from "../../queue/queue.client.js";

export const VIDEO_GENERATION_QUEUE = "video_generation";

export type VideoRenderScene = {
  order: number;
  type: "hook" | "benefit" | "proof" | "cta" | "detail";
  duration_seconds: number;
  source?: string;
  headline: string;
  subheadline?: string;
  instruction?: string;
};

export type VideoRenderPlan = {
  engine: string;
  format: string;
  ratio: string;
  duration: string | number;
  rhythm: string;
  audio: string;
  brand?: string;
  scenes: VideoRenderScene[];
  script: string;
};

export type VideoGenerationQueuePayload = {
  job_id: string;
  asset_id: string;
  product_name?: string;
  source_url?: string;
  media_urls?: string[];
  render_plan?: VideoRenderPlan;
  script?: string;
  ai_prompt?: string;
  duration?: string | number;
  ratio?: string;
};

export async function enqueueVideoGeneration(payload: VideoGenerationQueuePayload) {
  await enqueueJob(VIDEO_GENERATION_QUEUE, "render-video", payload, {
    jobId: payload.job_id,
  });
}
