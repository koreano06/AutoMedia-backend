import { jobsRepository } from "../jobs/jobs.repository.js";
import { mediaRepository } from "../media/media.repository.js";
import { productsRepository } from "../products/products.repository.js";
import { aiService } from "../ai/ai.service.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { GenerateVideoInput } from "./videos.schemas.js";
import { enqueueVideoGeneration } from "./video-generation.queue.js";

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

function buildRenderPlan(input: GenerateVideoInput, mediaUrls: string[], script: string) {
  return {
    engine: "pending-renderer",
    format: input.format || "reels",
    ratio: input.ratio || "9:16",
    duration: input.duration,
    rhythm: input.rhythm || "Cortes dinâmicos",
    audio: input.audio || "Música tendência",
    scenes: [
      { order: 1, type: "hook", duration_seconds: 4, source: mediaUrls[0] || "product_image", instruction: "Abrir com benefício claro e texto grande." },
      { order: 2, type: "benefits", duration_seconds: 12, source: mediaUrls[1] || mediaUrls[0] || "product_image", instruction: "Mostrar diferenciais com cortes curtos." },
      { order: 3, type: "proof", duration_seconds: 8, source: mediaUrls[2] || mediaUrls[0] || "product_image", instruction: "Reforçar uso real e confiança." },
      { order: 4, type: "cta", duration_seconds: 6, source: mediaUrls[0] || "product_image", instruction: "Finalizar com chamada para comentar eu quero." },
    ],
    script,
  };
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
    const aiResult = payload.script ? { text: payload.script, provider: "provided-script" } : aiService.generateText(prompt);
    const script = aiResult.text || prompt;
    const renderPlan = buildRenderPlan(payload, mediaUrls, script);
    const platforms = payload.platforms?.length ? payload.platforms : payload.platform ? [payload.platform] : [];
    const previewUrl = mediaUrls[0] || product.image_url || product.uploaded_image_url || "";

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
        source_url: previewUrl,
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
