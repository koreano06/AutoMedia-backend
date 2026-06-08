import { env } from "../../config/env.js";
import { ffmpegProvider } from "./ffmpeg.provider.js";
import type { VideoRenderPlan } from "../../modules/videos/video-generation.queue.js";

type RenderVideoInput = {
  jobId: string;
  assetId: string;
  productName?: string;
  sourceUrl?: string;
  mediaUrls?: string[];
  renderPlan?: VideoRenderPlan;
  duration?: string | number;
  ratio?: string;
};

export const videoRendererService = {
  async render(input: RenderVideoInput) {
    if (env.VIDEO_RENDER_DRIVER === "mock") {
      return {
        localPath: "",
        mime_type: "video/mp4",
        duration: input.duration || "30s",
        width: 1080,
        height: input.ratio === "16:9" ? 1080 : 1920,
        mock: true,
      };
    }

    return ffmpegProvider.render({
      sourceUrl: input.sourceUrl,
      mediaUrls: input.mediaUrls,
      renderPlan: input.renderPlan,
      productName: input.productName,
      duration: input.duration,
      ratio: input.ratio,
      outputName: `${input.jobId}-${input.assetId}`,
    });
  },
};
