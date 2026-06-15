import type { VideoRenderPlan } from "../../modules/videos/video-generation.queue.js";

export type AIVideoInput = {
  assetId: string;
  jobId: string;
  productName?: string;
  startImageUrl?: string;
  prompt: string;
  duration?: string | number;
  ratio?: string;
  renderPlan?: VideoRenderPlan;
};

export type AIVideoResult = {
  provider: string;
  model: string;
  prediction_id?: string;
  output_url: string;
  duration_seconds?: number;
  metadata?: Record<string, unknown>;
};
