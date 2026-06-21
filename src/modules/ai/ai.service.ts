import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";
import { mediaRepository } from "../media/media.repository.js";
import type { GenerateImageInput } from "./ai.schemas.js";

type OpenAIImageResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
};

type OpenAITextResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

type GenerateTextOptions = {
  instructions?: string;
  jsonSchema?: {
    name: string;
    schema: Record<string, unknown>;
    strict?: boolean;
  };
};

function buildLocalSuggestion(prompt: string) {
  const normalized = prompt.toLowerCase();

  if (normalized.includes("roteiro") || normalized.includes("vídeo") || normalized.includes("video")) {
    return [
      "Gancho inicial: mostre o produto em contexto real e destaque o principal beneficio em poucos segundos.",
      "Cena 1: texto grande na tela com uma promessa clara e visual focado no produto.",
      "Cena 2: apresente o benefício prático para a rotina do público-alvo.",
      "Cena 3: reforce confiança com uso real, clareza visual e ritmo dinâmico.",
      "Cena 4: finalize com CTA direto: comente 'eu quero' para receber o link.",
      "Legenda: Produto em destaque para facilitar sua rotina. Comente 'eu quero' para receber o link e ver os detalhes.",
    ].join("\n");
  }

  if (normalized.includes("coment")) {
    return "Claro! Obrigado pelo interesse. Posso te enviar o link do produto agora para voce conferir os detalhes e aproveitar a oferta.";
  }

  return "Destaque o benefício principal, mostre o produto em contexto real e finalize com uma chamada clara para o cliente pedir o link.";
}

function buildFallbackImage(prompt: string) {
  const safePrompt = prompt.replace(/[<>&"]/g, "");
  const title = safePrompt.slice(0, 92);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1020"/>
      <stop offset="48%" stop-color="#172554"/>
      <stop offset="100%" stop-color="#fb923c"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="38%" r="45%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1536" fill="url(#bg)"/>
  <circle cx="512" cy="500" r="390" fill="url(#glow)"/>
  <rect x="134" y="360" width="756" height="756" rx="88" fill="#ffffff" opacity="0.92"/>
  <rect x="214" y="448" width="596" height="520" rx="64" fill="#111827"/>
  <circle cx="512" cy="708" r="148" fill="#fb923c"/>
  <rect x="294" y="1038" width="436" height="34" rx="17" fill="#fb923c"/>
  <text x="512" y="1218" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="800" fill="#ffffff">Criativo IA</text>
  <text x="512" y="1290" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#ffffff" opacity="0.86">${title}</text>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

async function generateWithOpenAI(input: GenerateImageInput) {
  if (!env.OPENAI_API_KEY) {
    if (env.OPENAI_IMAGE_FALLBACK_ENABLED) {
      return { image_url: buildFallbackImage(input.prompt), provider: "local-fallback" };
    }

    throw new AppError(
      "OPENAI_API_KEY não configurada. Configure a chave real da OpenAI no backend/Vercel para gerar imagens profissionais.",
      409,
      "OPENAI_API_KEY_MISSING",
    );
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_IMAGE_MODEL,
      prompt: input.prompt,
      size: input.size,
      quality: env.OPENAI_IMAGE_QUALITY,
      n: 1,
    }),
  });

  const payload = (await response.json()) as OpenAIImageResponse & { error?: { message?: string } };

  if (!response.ok) {
    throw new AppError(payload.error?.message || "Falha ao gerar imagem com a API real de IA", response.status, "OPENAI_IMAGE_ERROR");
  }

  const image = payload.data?.[0];
  const imageUrl = image?.b64_json ? `data:image/png;base64,${image.b64_json}` : image?.url;

  if (!imageUrl) {
    throw new AppError("A API real de IA nao retornou uma imagem valida", 502, "OPENAI_IMAGE_EMPTY");
  }

  return { image_url: imageUrl, provider: "openai" };
}

function extractOpenAIText(payload: OpenAITextResponse) {
  if (payload.output_text) return payload.output_text;

  return (
    payload.output
      ?.flatMap((item) => item.content || [])
      .map((content) => content.text)
      .filter(Boolean)
      .join("\n")
      .trim() || ""
  );
}

async function generateTextWithOpenAI(prompt: string, options: GenerateTextOptions = {}) {
  if (!env.OPENAI_API_KEY) {
    return {
      text: buildLocalSuggestion(prompt),
      provider: "local-template",
    };
  }

  const requestBody: Record<string, unknown> = {
    model: env.OPENAI_TEXT_MODEL,
    instructions: options.instructions || [
      "Voce e um estrategista de criativos para social commerce.",
      "Escreva roteiros curtos, claros e prontos para videos verticais.",
      "Evite promessas exageradas, linguagem enganosa e tom de spam.",
      "Retorne em portugues do Brasil.",
    ].join(" "),
    input: prompt,
  };

  if (options.jsonSchema) {
    requestBody.text = {
      format: {
        type: "json_schema",
        name: options.jsonSchema.name,
        strict: options.jsonSchema.strict ?? true,
        schema: options.jsonSchema.schema,
      },
    };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const payload = (await response.json()) as OpenAITextResponse;

  if (!response.ok) {
    return {
      text: buildLocalSuggestion(prompt),
      provider: `local-template-openai-error-${response.status}`,
      error: payload.error?.message,
    };
  }

  const text = extractOpenAIText(payload);

  return {
    text: text || buildLocalSuggestion(prompt),
    provider: text ? "openai-responses" : "local-template-openai-empty",
  };
}

export const aiService = {
  async generateText(prompt: string, options?: GenerateTextOptions) {
    return generateTextWithOpenAI(prompt, options);
  },

  async generateImage(input: GenerateImageInput) {
    const result = await generateWithOpenAI(input);
    const asset = input.product_id
      ? await mediaRepository.create({
          product_id: input.product_id,
          product_name: input.product_name,
          type: "image",
          title: input.title || `Imagem IA - ${input.product_name || "produto"}`,
          status: "collected",
          source: result.provider === "openai" ? "OpenAI Images API" : "Fallback local",
          url: result.image_url,
          thumbnail_url: result.image_url,
          caption: input.prompt,
          platforms: input.platform ? [input.platform] : [],
          quality_score: result.provider === "openai" ? 88 : 62,
        })
      : null;

    return {
      image_url: result.image_url,
      provider: result.provider,
      asset,
    };
  },
};
