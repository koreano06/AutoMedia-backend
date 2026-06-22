import { jobsRepository } from "../jobs/jobs.repository.js";
import { mediaRepository } from "../media/media.repository.js";
import { productsRepository } from "../products/products.repository.js";
import { aiService } from "../ai/ai.service.js";
import { env } from "../../config/env.js";
import { storageService } from "../../integrations/storage/storage.service.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { GenerateVideoInput } from "./videos.schemas.js";
import { enqueueVideoGeneration, type VideoCostEstimate, type VideoRenderPlan, type VideoRenderScene } from "./video-generation.queue.js";
import { auditService } from "../audit/audit.service.js";

type AIVideoSceneType = VideoRenderScene["type"];

type AIVideoCreativeScene = {
  order: number;
  type: AIVideoSceneType;
  duration_seconds: number;
  scene_goal: string;
  headline: string;
  subheadline: string;
  instruction: string;
  visual_action: string;
  camera_direction: string;
  on_screen_text: string;
  voiceover: string;
  reference_asset_hint: string;
  transition_to_next: string;
};

type AIVideoCreativePlan = {
  hook: string;
  promise: string;
  target_audience: string;
  tone: string;
  cta: string;
  caption: string;
  script: string;
  safety_notes: string[];
  scenes: AIVideoCreativeScene[];
};

type SceneTextDraft = Pick<VideoRenderScene, "type" | "headline" | "subheadline" | "instruction"> & {
  duration_seconds?: number;
};

const VIDEO_CREATIVE_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["hook", "promise", "target_audience", "tone", "cta", "caption", "script", "safety_notes", "scenes"],
  properties: {
    hook: { type: "string" },
    promise: { type: "string" },
    target_audience: { type: "string" },
    tone: { type: "string" },
    cta: { type: "string" },
    caption: { type: "string" },
    script: { type: "string" },
    safety_notes: {
      type: "array",
      items: { type: "string" },
    },
    scenes: {
      type: "array",
      minItems: 4,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "order",
          "type",
          "duration_seconds",
          "scene_goal",
          "headline",
          "subheadline",
          "instruction",
          "visual_action",
          "camera_direction",
          "on_screen_text",
          "voiceover",
          "reference_asset_hint",
          "transition_to_next",
        ],
        properties: {
          order: { type: "integer" },
          type: { type: "string", enum: ["hook", "benefit", "proof", "detail", "cta"] },
          duration_seconds: { type: "integer", minimum: 3, maximum: 10 },
          scene_goal: { type: "string" },
          headline: { type: "string" },
          subheadline: { type: "string" },
          instruction: { type: "string" },
          visual_action: { type: "string" },
          camera_direction: { type: "string" },
          on_screen_text: { type: "string" },
          voiceover: { type: "string" },
          reference_asset_hint: { type: "string" },
          transition_to_next: { type: "string" },
        },
      },
    },
  },
};

function buildVideoCreativeInstructions() {
  return [
    "Voce e diretor criativo, roteirista de performance e estrategista de social commerce.",
    "Sua tarefa e transformar um anuncio base em um plano de video curto, realista e publicavel para redes sociais.",
    "Responda somente JSON valido obedecendo exatamente ao schema solicitado.",
    "Use apenas informacoes fornecidas no briefing. Nao invente preco, desconto, frete, garantia, estoque, marca, especificacoes tecnicas ou resultados nao informados.",
    "Nao cite marketplace, rede social, influenciador, cupom ou prazo se isso nao estiver no briefing.",
    "Cada cena precisa ser filmavel ou geravel por IA: unboxing, close do produto, demonstracao, controle/acessorio, resultado visual e CTA.",
    "Construa uma progressao narrativa conectada: a cena seguinte deve continuar a acao anterior, nunca parecer um clipe aleatorio.",
    "Cada cena precisa ter um objetivo unico: atrair atencao, revelar produto, demonstrar beneficio, provar uso, remover duvida ou chamar para acao.",
    "Descreva a acao visual com verbos concretos: abrir, aproximar, conectar, pressionar, projetar, comparar, mostrar, apontar, finalizar.",
    "Escreva headlines curtas para tela, com ate 8 palavras. Subheadline ate 14 palavras.",
    "A instrucao de cada cena deve ser objetiva, visual e sem ambiguidades para um gerador de video.",
    "Inclua uma transicao logica entre cenas para manter continuidade visual, como corte por movimento, zoom, match cut ou mudanca de foco.",
    "Evite exageros, spam, promessas absolutas, comparacoes nao comprovadas e claims sensiveis.",
    "O CTA deve ser natural e alinhado ao briefing, preferindo comentario, clique ou pedir link.",
    "Português do Brasil, tom comercial natural, claro e profissional.",
  ].join(" ");
}

function buildVideoPrompt(input: GenerateVideoInput, productName: string, productDescription?: string, mediaTitles: string[] = []) {
  const briefing = input.briefing_fields || {};
  const template = input.template || input.style || "product";
  const platforms = input.platforms?.length ? input.platforms.join(", ") : input.platform || "instagram";
  const durationSeconds = secondsFromDuration(input.duration);
  const sceneCount = Math.min(6, Math.max(4, Math.ceil(durationSeconds / 5)));
  const templateGuide: Record<string, string> = {
    unboxing: "Abrir com caixa/embalagem, revelar o produto, mostrar acessorios, demonstrar uso e fechar com CTA.",
    demonstracao: "Apresentar problema/contexto, mostrar recurso principal, demonstrar uso real, exibir resultado e fechar com CTA.",
    "antes-depois": "Mostrar situacao antes, introduzir produto, demonstrar transformacao visual e encerrar com resultado/CTA.",
    oferta: "Gancho de oportunidade, beneficio principal, prova visual, urgencia moderada e CTA sem linguagem agressiva.",
    review: "Vendedor apresenta o produto, mostra detalhes, explica beneficio, demonstra uso e recomenda proximo passo.",
    marketplace: "Comecar pelo uso pratico, reforcar clareza visual, destacar beneficio e orientar o usuario a pedir o link.",
    product: "Mostrar produto em contexto real, explicar beneficio, demonstrar uso e finalizar com CTA.",
  };

  return [
    "BRIEFING OPERACIONAL PARA PLANO DE VIDEO COM IA",
    "",
    "Objetivo:",
    "Criar um pre-roteiro estruturado para video vertical de divulgacao, pronto para gerar cenas por IA e renderizar no AutoMedia.",
    "O resultado precisa funcionar para qualquer categoria de produto, mas sem ficar generico demais: use os dados do produto, midias e template para dar direcao real.",
    "",
    "Dados do anuncio:",
    `- Produto/anuncio: ${productName}`,
    `- Descricao cadastrada: ${productDescription || "Nao informada"}`,
    `- Template escolhido: ${template}`,
    `- Regra do template: ${templateGuide[String(template).toLowerCase()] || templateGuide.product}`,
    `- Formato: ${input.format || "reels"}`,
    `- Proporcao: ${input.ratio || "9:16"}`,
    `- Duracao desejada: ${durationSeconds}s`,
    `- Quantidade esperada de cenas: ${sceneCount}. Nao use menos que 4 cenas, exceto se a duracao for extremamente curta.`,
    `- Ritmo: ${input.rhythm || "Cortes dinamicos, leitura facil e transicoes limpas"}`,
    `- Audio: ${input.audio || "Trilha moderna sem narracao obrigatoria"}`,
    `- Plataformas: ${platforms}`,
    "",
    "Briefing comercial:",
    `- Publico-alvo: ${briefing.targetAudience || "pessoas interessadas no produto"}`,
    `- Tom de voz: ${briefing.tone || "natural, vendedor consultivo, direto e confiavel"}`,
    `- Objetivo: ${briefing.objective || "gerar interesse e pedido de link"}`,
    `- Promessa principal permitida: ${briefing.promise || firstSentence(productDescription) || "mostrar o beneficio principal do produto"}`,
    `- CTA permitido: ${briefing.cta || "Comente EU QUERO para receber o link"}`,
    `- Restricoes: ${briefing.restrictions || "nao inventar informacoes, nao exagerar beneficios, nao usar tom apelativo"}`,
    `- Dor ou curiosidade inicial: ${briefing.painPoint || "mostrar por que o produto merece atencao nos primeiros segundos"}`,
    `- Objeção que o video deve reduzir: ${briefing.objection || "deixar claro como o produto e usado e qual valor ele entrega"}`,
    "",
    "Materiais visuais disponiveis:",
    `- Midias selecionadas: ${mediaTitles.length ? mediaTitles.join(" | ") : "imagem principal do anuncio ou imagem enviada pelo usuario"}`,
    `- Direcao visual adicional: ${input.visual_prompt || "produto em destaque, ambiente realista, texto legivel e composicao limpa"}`,
    `- Observacoes livres do usuario: ${input.briefing || briefing.extra || "sem observacoes extras"}`,
    "",
    "Regras obrigatorias de saida:",
    "- Responder somente no JSON do schema.",
    "- Criar cenas na ordem logica: gancho, revelacao do produto, demonstracao/beneficio, prova/detalhe, CTA.",
    "- Cada cena precisa conter: objetivo da cena, acao visual, instrucao fechada, camera_direction, texto na tela, narracao curta e transicao para a proxima.",
    "- O video deve parecer uma unica historia curta, nao uma lista de takes desconectados.",
    "- Se o template for unboxing/review, use linguagem de vendedor demonstrando o produto de forma natural.",
    "- Se o video tiver 15 a 20 segundos, prefira 4 ou 5 cenas de 3 a 5 segundos com conexao clara entre elas.",
    "- Se alguma informacao nao existir, use uma formulacao neutra. Nao invente dado tecnico.",
    "- Nao incluir explicacoes fora do JSON.",
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

function normalizeSceneType(value?: string): AIVideoSceneType {
  if (value === "hook" || value === "benefit" || value === "proof" || value === "detail" || value === "cta") return value;
  return "detail";
}

function extractJsonText(value?: string) {
  const text = compactText(value);
  if (!text) return "";
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) return fenced.trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text;
}

function parseCreativePlan(value?: string): AIVideoCreativePlan | undefined {
  try {
    const parsed = JSON.parse(extractJsonText(value)) as Partial<AIVideoCreativePlan>;
    if (!Array.isArray(parsed.scenes) || !parsed.scenes.length) return undefined;

    return {
      hook: compactText(parsed.hook, "Gancho do produto"),
      promise: compactText(parsed.promise, "Beneficio principal"),
      target_audience: compactText(parsed.target_audience, "Publico interessado"),
      tone: compactText(parsed.tone, "Natural e direto"),
      cta: compactText(parsed.cta, "Comente EU QUERO"),
      caption: compactText(parsed.caption, ""),
      script: compactText(parsed.script, ""),
      safety_notes: Array.isArray(parsed.safety_notes) ? parsed.safety_notes.map((note) => compactText(note)).filter(Boolean) : [],
      scenes: parsed.scenes.slice(0, 6).map((scene, index) => ({
        order: Number(scene.order || index + 1),
        type: normalizeSceneType(scene.type),
        duration_seconds: Math.min(10, Math.max(3, Number(scene.duration_seconds || 5))),
        scene_goal: compactText(scene.scene_goal, "Conduzir a narrativa do produto."),
        headline: limitText(scene.headline || `Cena ${index + 1}`, 48),
        subheadline: limitText(scene.subheadline || "", 76),
        instruction: compactText(scene.instruction, "Mostrar o produto com clareza."),
        visual_action: compactText(scene.visual_action, "Mostrar o produto em uso real."),
        camera_direction: compactText(scene.camera_direction, "Camera vertical, movimento suave e foco no produto."),
        on_screen_text: limitText(scene.on_screen_text || scene.headline || "", 72),
        voiceover: compactText(scene.voiceover, ""),
        reference_asset_hint: compactText(scene.reference_asset_hint, "Usar a imagem mais proxima do produto."),
        transition_to_next: compactText(scene.transition_to_next, "Corte suave mantendo continuidade do produto."),
      })),
    };
  } catch {
    return undefined;
  }
}

function buildScriptFromCreativePlan(plan?: AIVideoCreativePlan) {
  if (!plan) return "";

  return [
    plan.hook ? `Gancho: ${plan.hook}` : "",
    plan.promise ? `Promessa: ${plan.promise}` : "",
    ...plan.scenes.map((scene) => `Cena ${scene.order}: ${scene.voiceover || scene.on_screen_text || scene.headline}`),
    plan.cta ? `CTA: ${plan.cta}` : "",
    plan.caption ? `Legenda: ${plan.caption}` : "",
  ].filter(Boolean).join("\n");
}

function buildSceneTexts(input: GenerateVideoInput, productName: string, productDescription?: string, creativePlan?: AIVideoCreativePlan) {
  if (creativePlan?.scenes?.length) {
    return creativePlan.scenes.map((scene) => ({
      type: scene.type,
      headline: limitText(scene.headline, 48),
      subheadline: limitText(scene.subheadline || scene.on_screen_text, 76),
      instruction: [
        scene.scene_goal ? `Objetivo da cena: ${scene.scene_goal}` : "",
        scene.visual_action ? `Acao visual: ${scene.visual_action}` : "",
        scene.instruction,
        scene.camera_direction ? `Camera: ${scene.camera_direction}` : "",
        scene.on_screen_text ? `Texto na tela: ${scene.on_screen_text}` : "",
        scene.voiceover ? `Narracao: ${scene.voiceover}` : "",
        scene.reference_asset_hint ? `Referencia visual: ${scene.reference_asset_hint}` : "",
        scene.transition_to_next ? `Transicao: ${scene.transition_to_next}` : "",
      ].filter(Boolean).join(" "),
      duration_seconds: scene.duration_seconds,
    })) as SceneTextDraft[];
  }

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
  ] as SceneTextDraft[];
}

function buildRenderPlan(
  input: GenerateVideoInput,
  mediaUrls: string[],
  script: string,
  productName: string,
  productDescription?: string,
  creativePlan?: AIVideoCreativePlan,
): VideoRenderPlan {
  const totalSeconds = secondsFromDuration(input.duration);
  const durations = sceneDurations(totalSeconds);
  const sceneTexts = buildSceneTexts(input, productName, productDescription, creativePlan);
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
      id: `scene_${index + 1}`,
      ...scene,
      order: index + 1,
      duration_seconds: scene.duration_seconds || durations[index] || 4,
      source: mediaUrls[index] || fallbackSource,
    })),
    script,
  };
}

function buildScenePlan(renderPlan: VideoRenderPlan, mediaTitles: string[]) {
  return {
    ...renderPlan,
    scenes: renderPlan.scenes.map((scene, index) => ({
      ...scene,
      reference_asset_title: mediaTitles[index] || mediaTitles[0] || "Imagem principal do anúncio",
      locked_instruction: [
        `Cena ${scene.order}: ${scene.headline}.`,
        scene.subheadline ? `Subtexto: ${scene.subheadline}.` : "",
        scene.instruction ? `Direção: ${scene.instruction}` : "",
        "Manter o mesmo produto, iluminação, cenário e identidade visual do início ao fim.",
      ].filter(Boolean).join(" "),
    })),
  };
}

function estimateVideoCost(duration: string | number | undefined): VideoCostEstimate {
  const durationSeconds = secondsFromDuration(duration);
  const segments = Math.max(1, Math.ceil(durationSeconds / 10));
  const perSegment = env.AI_VIDEO_PROVIDER === "replicate_kling" ? env.AI_VIDEO_SEGMENT_ESTIMATED_COST_USD : 0;
  const ffmpegCost = env.AI_VIDEO_FFMPEG_ESTIMATED_COST_USD;
  const estimated = env.AI_VIDEO_PROVIDER === "replicate_kling"
    ? Number((segments * perSegment).toFixed(4))
    : Number(ffmpegCost.toFixed(4));

  return {
    provider: env.AI_VIDEO_PROVIDER,
    model: env.AI_VIDEO_PROVIDER === "replicate_kling" ? env.REPLICATE_KLING_MODEL : "ffmpeg",
    currency: "USD",
    estimated_cost_usd: estimated,
    estimated_cost_per_segment_usd: perSegment,
    ffmpeg_cost_usd: ffmpegCost,
    duration_seconds: durationSeconds,
    segments,
    source: estimated > 0 ? "configured_estimate" : "not_configured",
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

function isExternalPublicHttpUrl(value?: string) {
  return typeof value === "string" && isHttpUrl(value) && !isInternalStorageUrl(value);
}

function shouldUseExternalAiVideoUrl() {
  return env.AI_VIDEO_PROVIDER === "replicate_kling";
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
  async generate(payload: GenerateVideoInput, workspaceId?: string, actorId?: string) {
    const product = await productsRepository.findById(payload.product_id);
    if (!product) throw new AppError("Anúncio base não encontrado para geração de vídeo", 404, "AD_NOT_FOUND");

    const selectedMedia = await Promise.all((payload.media_asset_ids || []).map((id) => mediaRepository.findById(id)));
    const usableMedia = selectedMedia.filter(Boolean);
    const mediaUrls = usableMedia.map((asset) => asset?.url || asset?.thumbnail_url).filter(Boolean) as string[];
    const mediaTitles = usableMedia.map((asset) => asset?.title || asset?.source || asset?.url).filter(Boolean) as string[];
    const prompt = buildVideoPrompt(payload, product.name, product.description, mediaTitles);
    const aiResult = payload.script
      ? { text: payload.script, provider: "provided-script" }
      : await aiService.generateText(prompt, {
          instructions: buildVideoCreativeInstructions(),
          jsonSchema: {
            name: "automedia_video_creative_plan",
            schema: VIDEO_CREATIVE_PLAN_SCHEMA,
            strict: true,
          },
        });
    const creativePlan = payload.script ? undefined : parseCreativePlan(aiResult.text);
    const script = payload.script || buildScriptFromCreativePlan(creativePlan) || aiResult.text || prompt;
    const productImageUrl = product.image_url || product.uploaded_image_url || "";
    const rawRenderMediaUrls = [...mediaUrls, productImageUrl].filter(Boolean);
    const mediaCache = await cacheRenderMediaUrls(rawRenderMediaUrls, workspaceId || product.workspace_id, product.id);
    const renderMediaUrls = mediaCache.urls;
    const renderPlan = buildRenderPlan(payload, renderMediaUrls, script, product.name, product.description, creativePlan);
    const scenePlan = buildScenePlan(renderPlan, mediaTitles);
    const costEstimate = estimateVideoCost(payload.duration);
    const platforms = payload.platforms?.length ? payload.platforms : payload.platform ? [payload.platform] : [];
    const previewUrl = renderMediaUrls[0] || "";
    const externalAiStartUrl = rawRenderMediaUrls.find(isExternalPublicHttpUrl);
    const queueSourceUrl = shouldUseExternalAiVideoUrl() ? externalAiStartUrl || previewUrl : previewUrl;

    const job = await jobsRepository.create({
      type: "video_generation",
      status: "queued",
      title: `Gerar vídeo de divulgação ${payload.template || payload.style} - ${product.name}`,
      workspace_id: workspaceId || product.workspace_id,
      product_id: product.id,
      progress: 0,
      payload: {
        product_id: product.id,
        product_name: product.name,
        requested_by_user_id: actorId,
        ai_video_stage: "queued",
        template: payload.template || payload.style,
        format: payload.format || "reels",
        ratio: payload.ratio || "9:16",
        duration: payload.duration,
        platform: payload.platform,
        platforms,
        media_asset_ids: payload.media_asset_ids || [],
        reference_image_urls: renderMediaUrls,
        scene_plan: scenePlan,
        creative_plan: creativePlan,
        cost_estimate: costEstimate,
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
        ai_video_provider: env.AI_VIDEO_PROVIDER,
        generation_version: 1,
        render_plan: renderPlan,
        scene_plan: scenePlan,
        creative_plan: creativePlan,
        cost_estimate: costEstimate,
        prompt,
        media_asset_ids: payload.media_asset_ids || [],
        cached_media: mediaCache.cacheMetadata,
        external_ai_start_url: externalAiStartUrl,
        visual_prompt: payload.visual_prompt,
      },
    });

    await auditService.log({
      actor_id: actorId,
      action: "video.generate.requested",
      entity_type: "job",
      entity_id: job.id,
      metadata: {
        product_id: product.id,
        asset_id: asset.id,
        provider: env.AI_VIDEO_PROVIDER,
        duration: payload.duration,
        segments: costEstimate.segments,
        estimated_cost_usd: costEstimate.estimated_cost_usd,
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
        requested_by_user_id: actorId,
        product_name: product.name,
        source_url: queueSourceUrl,
        media_urls: renderMediaUrls,
        render_plan: renderPlan,
        scene_plan: scenePlan,
        creative_plan: creativePlan,
        cost_estimate: costEstimate,
        script,
        ai_prompt: prompt,
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
        requested_by_user_id: actorId,
        product_name: product.name,
        ai_video_stage: "queued",
        ai_provider: aiResult.provider,
        ai_video_provider: env.AI_VIDEO_PROVIDER,
        prompt,
        render_plan: renderPlan,
        scene_plan: scenePlan,
        cost_estimate: costEstimate,
        cached_media: mediaCache.cacheMetadata,
        external_ai_start_url: externalAiStartUrl,
        media_asset_ids: payload.media_asset_ids || [],
      },
      result: {
        asset_id: asset.id,
        queue: "video_generation",
        cost_estimate: costEstimate,
      },
    });

    return {
      job: queuedJob,
      asset,
      script,
      render_plan: renderPlan,
      creative_plan: creativePlan,
      provider: aiResult.provider,
    };
  },
};
