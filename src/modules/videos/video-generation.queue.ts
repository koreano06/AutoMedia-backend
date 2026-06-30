import { enqueueJob } from "../../queue/queue.client.js";

export const VIDEO_GENERATION_QUEUE = "video_generation";

export type VideoRenderScene = {
  id?: string;
  order: number;
  type: "hook" | "benefit" | "proof" | "cta" | "detail";
  duration_seconds: number;
  source?: string;
  headline: string;
  subheadline?: string;
  instruction?: string;
  scene_goal?: string;
  visual_action?: string;
  camera_direction?: string;
  on_screen_text?: string;
  voiceover?: string;
  reference_asset_hint?: string;
  visual_fidelity?: string;
  transition_to_next?: string;
  prompt_video_ia?: string;
  plano_camera?: string;
  movimento_camera?: string;
  ambiente?: string;
  iluminacao?: string;
  restricoes_ia?: string;
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

export type VideoCostEstimate = {
  provider: string;
  model?: string;
  currency: "USD";
  estimated_cost_usd: number;
  estimated_cost_per_segment_usd: number;
  ffmpeg_cost_usd?: number;
  duration_seconds: number;
  segments: number;
  source: "configured_estimate" | "not_configured";
};

export type VideoGenerationQueuePayload = {
  job_id: string;
  asset_id: string;
  requested_by_user_id?: string;
  product_name?: string;
  source_url?: string;
  media_urls?: string[];
  render_plan?: VideoRenderPlan;
  scene_plan?: VideoRenderPlan;
  creative_plan?: unknown;
  cost_estimate?: VideoCostEstimate;
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
