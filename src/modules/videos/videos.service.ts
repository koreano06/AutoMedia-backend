import { jobsRepository } from "../jobs/jobs.repository.js";
import { mediaRepository } from "../media/media.repository.js";
import { productsRepository } from "../products/products.repository.js";
import { aiService } from "../ai/ai.service.js";
import { env } from "../../config/env.js";
import { storageService } from "../../integrations/storage/storage.service.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { GenerateVideoInput } from "./videos.schemas.js";
import { enqueueVideoGeneration, type VideoRenderPlan, type VideoRenderScene } from "./video-generation.queue.js";

function buildVideoPrompt(input: GenerateVideoInput, productName: string, productDescription?: string, mediaTitles: string[] = []) {
  const briefing = input.briefing_fields || {};
  const template = input.template || input.style || "product";
  const platforms = input.platforms?.length ? input.platforms.join(", ") : input.platform || "instagram";

  return [
    "Crie um pacote profissional para gerar um vídeo de divulgação a partir de um anúncio base.",
    `Anúncio/oferta base: ${productName}`,
    `Descrição do anúncio: ${productDescription || "Sem descrição cadastrada"}`,
    `Template/estilo: ${template}`,
    `Formato: ${input.format || "reels"} ${input.ratio || "9:16"}`,
    `Duração: ${input.duration}`,
    `Ritmo: ${input.rhythm || "Cortes dinâmicos"}`,
    `Áudio: ${input.audio || "Música tendência"}`,
    `Plataformas: ${platforms}`,
    `Público-alvo: ${briefing.targetAudience || "compradores interessados"}`,
    `Tom de voz: ${briefing.tone || "Direto, natural e persuasivo"}`,
    `Objetivo: ${briefing.objective || "Divulgação"}`,
    `Promessa principal: ${briefing.promise || "benefício claro da oferta"}`,
    `CTA: ${briefing.cta || "Comente eu quero para receber o link"}`,
    `Restrições: ${briefing.restrictions || "evitar promessas exageradas e linguagem de spam"}`,
    `Mídias selecionadas: ${mediaTitles.length ? mediaTitles.join(", ") : "usar imagem principal do anúncio"}`,
    `Direção visual adicional: ${input.visual_prompt || "visual limpo, foco no produto, texto legível"}`,
    `Briefing livre: ${input.briefing || briefing.extra || "sem briefing extra"}`,
    "",
    "Retorne em português com:",
    "1. Gancho inicial",
    "2. Cenas sugeridas com ordem",
    "3. Texto na tela por cena",
    "4. Legenda para publicação",
    "5. CTA final",
    "6. Observações de naturalidade/anti-spam",
  ].join("\n");
}

function compactText(value?: string, fallback = "") {
  return String(value || fallback)
    .replace(/\s+/g, " ")
    .trim();
}

function limitText(value: string, maxLength: number) {
  const clean = compactText(value);
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trim()}…`;
}

function firstSentence(value?: string) {
  return compactText(value).split(/[.!?]/)[0] || "";
}

function secondsFromDuration(duration?: string | number) {
  if (typeof duration === "number") return Math.max(12, duration);
  const match = String(duration || "30s").match(/\d+/);
  return Math.max(12, Number(match?.[0] || 30));
}

function sceneDurations(totalSeconds: number) {
  const base = Math.max(3, Math.floor(totalSeconds / 4));
  const remainder = totalSeconds - base * 4;
  return [base, base + Math.max(0, remainder), base, base];
}

function buildSceneTexts(input: GenerateVideoInput, productName: string, productDescription?: string) {
  const briefing = input.briefing_fields || {};
  const benefit = briefing.promise || firstSentence(productDescription) || "Mais praticidade no dia a dia";
  const target = briefing.targetAudience || "sua rotina";
  const cta = briefing.cta || "Comente EU QUERO";

  return [
    {
      type: "hook",
      headline: limitText(`Olha esse ${productName}`, 46),
      subheadline: limitText(briefing.objective || "Criativo pronto para chamar atenção", 64),
      instruction: "Abrir com movimento leve, texto grande e leitura rápida.",
    },
    {
      type: "benefit",
      headline: limitText(benefit, 48),
      subheadline: limitText(`Ideal para ${target}`, 64),
      instruction: "Destacar o principal benefício com zoom no produto.",
    },
    {
      type: "proof",
      headline: limitText("Visual de anúncio pronto", 42),
      subheadline: limitText(briefing.tone || "Mensagem direta, natural e sem exagero", 64),
      instruction: "Reforçar confiança e clareza antes do CTA.",
    },
    {
      type: "cta",
      headline: limitText(cta, 42),
      subheadline: limitText("Receba o link e veja os detalhes", 64),
      instruction: "Fechar com chamada forte e barra visual completa.",
    },
  ] as Array<Pick<VideoRenderScene, "type" | "headline" | "subheadline" | "instruction">>;
}

function buildRenderPlan(input: GenerateVideoInput, mediaUrls: string[], script: string, productName: string, productDescription?: string): VideoRenderPlan {
  const totalSeconds = secondsFromDuration(input.duration);
  const durations = sceneDurations(totalSeconds);
  const sceneTexts = buildSceneTexts(input, productName, productDescription);
  const fallbackSource = mediaUrls[0] || "product_image";

  return {
    engine: "ffmpeg-scene-composer",
    format: input.format || "reels",
    ratio: input.ratio || "9:16",
    duration: input.duration,
    rhythm: input.rhythm || "Cortes dinâmicos",
    audio: input.audio || "Música tendência",
    brand: "AutoMedia",
    scenes: sceneTexts.map((scene, index) => ({
      ...scene,
      order: index + 1,
      duration_seconds: durations[index] || 4,
      source: mediaUrls[index] || fallbackSource,
    })),
    script,
  };
}

function isHttpUrl(value?: string) {
  return /^https?:\/\//i.test(String(value || ""));
}

function isInternalStorageUrl(value: string) {
  const candidates = [
    env.API_PUBLIC_URL,
    env.S3_PUBLIC_URL,
    env.S3_ENDPOINT,
    env.SUPABASE_URL,
  ].filter(Boolean) as string[];

  return candidates.some((candidate) => value.startsWith(candidate.replace(/\/$/, "")));
}

async function cacheRenderMediaUrls(urls: string[], workspaceId: string | undefined, productId: string) {
  const cachedUrls: string[] = [];
  const cacheMetadata = [];

  for (const [index, url] of urls.entries()) {
    if (!isHttpUrl(url) || isInternalStorageUrl(url)) {
      cachedUrls.push(url);
      continue;
    }

    try {
      const cached = await storageService.cacheRemoteMedia({
        url,
        keyPrefix: `source-media/${workspaceId || "global"}/${productId}`,
        fallbackName: `media-${index}`,
      });

      cachedUrls.push(cached.url);
      cacheMetadata.push({
        original_url: url,
        cached_url: cached.url,
        storage_key: cached.storage_key,
        content_type: cached.content_type,
        size: cached.size,
      });
    } catch {
      cachedUrls.push(url);
    }
  }

  return { urls: cachedUrls, cacheMetadata };
}

export const videosService = {
  async generate(payload: GenerateVideoInput, workspaceId?: string) {
    const product = await productsRepository.findById(payload.product_id);
    if (!product) throw new AppError("Anúncio base não encontrado para geração de vídeo", 404, "AD_NOT_FOUND");

    const selectedMedia = await Promise.all((payload.media_asset_ids || []).map((id) => mediaRepository.findById(id)));
    const usableMedia = selectedMedia.filter(Boolean);
    const mediaUrls = usableMedia.map((asset) => asset?.url || asset?.thumbnail_url).filter(Boolean) as string[];
    const mediaTitles = usableMedia.map((asset) => asset?.title || asset?.source || asset?.url).filter(Boolean) as string[];
    const prompt = buildVideoPrompt(payload, product.name, product.description, mediaTitles);
    const aiResult = payload.script ? { text: payload.script, provider: "provided-script" } : await aiService.generateText(prompt);
    const script = aiResult.text || prompt;
    const productImageUrl = product.image_url || product.uploaded_image_url || "";
    const rawRenderMediaUrls = [...mediaUrls, productImageUrl].filter(Boolean);
    const mediaCache = await cacheRenderMediaUrls(rawRenderMediaUrls, workspaceId || product.workspace_id, product.id);
    const renderMediaUrls = mediaCache.urls;
    const renderPlan = buildRenderPlan(payload, renderMediaUrls, script, product.name, product.description);
    const platforms = payload.platforms?.length ? payload.platforms : payload.platform ? [payload.platform] : [];
    const previewUrl = renderMediaUrls[0] || "";

    const job = await jobsRepository.create({
      type: "video_generation",
      status: "queued",
      title: `Gerar vídeo de divulgação ${payload.template || payload.style} - ${product.name}`,
      workspace_id: workspaceId || product.workspace_id,
      product_id: product.id,
      progress: 0,
      payload: {
        product_id: product.id,
        template: payload.template || payload.style,
        format: payload.format || "reels",
        ratio: payload.ratio || "9:16",
        duration: payload.duration,
        platform: payload.platform,
        platforms,
        media_asset_ids: payload.media_asset_ids || [],
      },
    });

    const asset = await mediaRepository.create({
      product_id: product.id,
      workspace_id: workspaceId || product.workspace_id,
      product_name: product.name,
      type: "generated_video",
      title: `Vídeo de divulgação ${payload.template || payload.style} - ${product.name}`,
      status: "generating",
      source: "Automedia Video Orchestrator",
      url: previewUrl,
      thumbnail_url: previewUrl,
      caption: script,
      platforms,
      quality_score: previewUrl ? 82 : 64,
      duration: payload.duration,
      metadata: {
        ai_provider: aiResult.provider,
        render_plan: renderPlan,
        prompt,
        media_asset_ids: payload.media_asset_ids || [],
        cached_media: mediaCache.cacheMetadata,
        visual_prompt: payload.visual_prompt,
      },
    });

    await productsRepository.update(product.id, {
      status: "review",
      videos_generated: (product.videos_generated || 0) + 1,
    });

    try {
      await enqueueVideoGeneration({
        job_id: job.id,
        asset_id: asset.id,
        product_name: product.name,
        source_url: previewUrl,
        media_urls: renderMediaUrls,
        render_plan: renderPlan,
        script,
        duration: payload.duration,
        ratio: payload.ratio || "9:16",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fila de renderizacao indisponivel";

      await jobsRepository.update(job.id, {
        status: "failed",
        progress: 100,
        media_asset_id: asset.id,
        error_message: message,
      });

      await mediaRepository.update(asset.id, {
        status: "failed",
        review_notes: message,
      });

      throw new AppError(
        "Nao foi possivel enviar o video para a fila de renderizacao. Verifique o REDIS_URL e o worker de video.",
        503,
        "VIDEO_QUEUE_UNAVAILABLE",
      );
    }

    const queuedJob = await jobsRepository.update(job.id, {
      status: "processing",
      progress: 15,
      media_asset_id: asset.id,
      payload: {
        asset_id: asset.id,
        ai_provider: aiResult.provider,
        prompt,
        render_plan: renderPlan,
        cached_media: mediaCache.cacheMetadata,
        media_asset_ids: payload.media_asset_ids || [],
      },
      result: {
        asset_id: asset.id,
        queue: "video_generation",
      },
    });

    return {
      job: queuedJob,
      asset,
      script,
      render_plan: renderPlan,
      provider: aiResult.provider,
    };
  },
};
