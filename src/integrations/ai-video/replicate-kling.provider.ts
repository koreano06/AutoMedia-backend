import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { AIVideoInput, AIVideoResult } from "./ai-video.types.js";

type ReplicatePrediction = {
  id?: string;
  status?: "starting" | "processing" | "succeeded" | "canceled" | "failed";
  output?: string | string[] | Record<string, unknown> | null;
  error?: string | null;
  urls?: {
    get?: string;
  };
  metrics?: Record<string, unknown>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPrivateHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

function assertPublicImageUrl(url?: string) {
  if (!url) {
    throw new AppError("A geração por IA precisa de uma imagem inicial pública do produto.", 409, "AI_VIDEO_START_IMAGE_REQUIRED");
  }

  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol) || isPrivateHost(parsed.hostname)) {
    throw new AppError("A imagem inicial precisa estar em uma URL pública para a IA de vídeo acessar.", 409, "AI_VIDEO_START_IMAGE_NOT_PUBLIC");
  }
}

function normalizeDuration(duration?: string | number) {
  const numeric = typeof duration === "number" ? duration : Number(String(duration || "").match(/\d+/)?.[0] || 5);
  return numeric >= 10 ? 10 : 5;
}

function modelPath() {
  const [owner, model] = env.REPLICATE_KLING_MODEL.split("/");
  if (!owner || !model) {
    throw new AppError("REPLICATE_KLING_MODEL deve usar o formato owner/model.", 500, "REPLICATE_MODEL_INVALID");
  }

  return `${owner}/${model}`;
}

function extractOutputUrl(output: ReplicatePrediction["output"]) {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return output.find((item) => typeof item === "string") || "";
  if (output && typeof output === "object") {
    const values = Object.values(output);
    return values.find((item): item is string => typeof item === "string" && /^https?:\/\//i.test(item)) || "";
  }

  return "";
}

function buildPrompt(input: AIVideoInput) {
  const sceneDirections = input.renderPlan?.scenes
    ?.map((scene) => [
      `${scene.order}. ${scene.type}: ${scene.headline}${scene.subheadline ? ` - ${scene.subheadline}` : ""}`,
      scene.visual_action ? `Action: ${scene.visual_action}` : "",
      scene.prompt_video_ia ? `Scene prompt: ${scene.prompt_video_ia}` : "",
      scene.plano_camera ? `Camera plan: ${scene.plano_camera}` : "",
      scene.movimento_camera ? `Movement: ${scene.movimento_camera}` : "",
      scene.ambiente ? `Environment: ${scene.ambiente}` : "",
      scene.iluminacao ? `Lighting: ${scene.iluminacao}` : "",
      scene.visual_fidelity ? `Fidelity: ${scene.visual_fidelity}` : "",
      scene.restricoes_ia ? `Restrictions: ${scene.restricoes_ia}` : "",
      scene.transition_to_next ? `Transition: ${scene.transition_to_next}` : "",
    ].filter(Boolean).join(". "))
    .join(" | ");

  return [
    `Create a professional vertical product advertising video for: ${input.productName || "product"}.`,
    "Style: realistic unboxing/product demo, cinematic ecommerce lighting, natural camera movement, premium social media ad.",
    "Motion: slow push-in, handheld product reveal, subtle parallax, clean background, no distorted text.",
    "Composition: strict vertical 9:16, product visible in the safe area, clear readable large text only if needed, no clutter.",
    "Mandatory product fidelity: keep the exact same product from the user's reference image and platform request. Do not change model, color, shape, scale, texture, packaging, screen, remote/control, visible logo, accessories, buttons or physical details. If a detail is unclear, simplify the shot instead of inventing a different or generic product.",
    "Reference image rule: treat the reference image as a product identity lock, not as a loose moodboard. Preserve the real product first; cinematic style is secondary.",
    "Background/context rule: use the exact environment, background, props and lighting described by the storyboard. If missing, choose a realistic real-use setting that makes sense for this product category.",
    "Practical demonstration rule: every shot must either reveal the product, show a real product detail, show a hand using it, or show the practical result/context of use. No disconnected lifestyle filler.",
    "Continuity: every shot must feel like part of the same short ad, with matching lighting, environment, product state and camera style.",
    "Avoid: generic substitute products, random backgrounds, abstract studios, extra accessories, invented labels, small unreadable text, deformed hands, unrelated props, fake UI screens, sudden scene jumps.",
    sceneDirections ? `Storyboard: ${sceneDirections}.` : "",
    input.prompt,
  ].filter(Boolean).join("\n");
}

async function postPrediction(input: AIVideoInput) {
  if (!env.REPLICATE_API_TOKEN) {
    throw new AppError("REPLICATE_API_TOKEN não configurado para geração real de vídeo IA.", 409, "REPLICATE_TOKEN_MISSING");
  }

  assertPublicImageUrl(input.startImageUrl);

  const response = await fetch(`https://api.replicate.com/v1/models/${modelPath()}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
      Prefer: "wait=5",
    },
    body: JSON.stringify({
      input: {
        prompt: buildPrompt(input),
        negative_prompt: env.REPLICATE_KLING_NEGATIVE_PROMPT,
        mode: env.REPLICATE_KLING_MODE,
        start_image: input.startImageUrl,
        duration: normalizeDuration(input.duration),
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AppError(payload.detail || payload.error || "Falha ao iniciar geração no Replicate/Kling.", response.status, "REPLICATE_CREATE_FAILED");
  }

  return payload as ReplicatePrediction;
}

async function getPrediction(url: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AppError(payload.detail || payload.error || "Falha ao consultar geração no Replicate/Kling.", response.status, "REPLICATE_POLL_FAILED");
  }

  return payload as ReplicatePrediction;
}

export const replicateKlingProvider = {
  async generate(input: AIVideoInput): Promise<AIVideoResult> {
    const startedAt = Date.now();
    let prediction = await postPrediction(input);

    while (prediction.status !== "succeeded") {
      if (prediction.status === "failed" || prediction.status === "canceled") {
        throw new AppError(prediction.error || "Replicate/Kling não conseguiu gerar o vídeo.", 502, "REPLICATE_GENERATION_FAILED");
      }

      if (!prediction.urls?.get) {
        throw new AppError("Replicate/Kling não retornou URL de acompanhamento da geração.", 502, "REPLICATE_POLL_URL_MISSING");
      }

      if (Date.now() - startedAt > env.REPLICATE_TIMEOUT_MS) {
        throw new AppError("Tempo limite excedido aguardando o vídeo IA.", 504, "REPLICATE_TIMEOUT");
      }

      await sleep(env.REPLICATE_POLL_INTERVAL_MS);
      prediction = await getPrediction(prediction.urls.get);
    }

    const outputUrl = extractOutputUrl(prediction.output);
    if (!outputUrl) {
      throw new AppError("Replicate/Kling finalizou, mas não retornou uma URL de vídeo.", 502, "REPLICATE_OUTPUT_EMPTY");
    }

    return {
      provider: "replicate_kling",
      model: env.REPLICATE_KLING_MODEL,
      prediction_id: prediction.id,
      output_url: outputUrl,
      duration_seconds: normalizeDuration(input.duration),
      metadata: {
        mode: env.REPLICATE_KLING_MODE,
        metrics: prediction.metrics || null,
      },
    };
  },
};
