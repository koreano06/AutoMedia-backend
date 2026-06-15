import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { AIVideoInput, AIVideoResult } from "./ai-video.types.js";
import { replicateKlingProvider } from "./replicate-kling.provider.js";

export const aiVideoService = {
  shouldUseExternalProvider() {
    return env.AI_VIDEO_PROVIDER === "replicate_kling";
  },

  shouldFallbackToFfmpeg(error: unknown) {
    if (!env.AI_VIDEO_FALLBACK_TO_FFMPEG) return false;
    if (error instanceof AppError && error.statusCode >= 400) return true;
    return true;
  },

  async generate(input: AIVideoInput): Promise<AIVideoResult> {
    if (env.AI_VIDEO_PROVIDER === "replicate_kling") {
      return replicateKlingProvider.generate(input);
    }

    throw new AppError("Nenhum provedor externo de vídeo IA habilitado.", 409, "AI_VIDEO_PROVIDER_DISABLED");
  },
};
