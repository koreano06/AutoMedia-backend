import type { FastifyInstance } from "fastify";
import { z } from "zod";

const generateTextSchema = z.object({
  prompt: z.string().min(1),
});

function buildLocalSuggestion(prompt: string) {
  const normalized = prompt.toLowerCase();

  if (normalized.includes("coment")) {
    return "Claro! Obrigado pelo interesse. Posso te enviar o link do produto agora para voce conferir os detalhes e aproveitar a oferta.";
  }

  if (normalized.includes("roteiro") || normalized.includes("vídeo") || normalized.includes("video")) {
    return [
      "Abertura: mostre o produto em uso e destaque o principal beneficio em 3 segundos.",
      "Meio: apresente 2 diferenciais práticos, com cortes rápidos e legenda na tela.",
      "Fechamento: inclua uma chamada para ação: comente 'eu quero' para receber o link.",
    ].join("\n");
  }

  return "Destaque o benefício principal, mostre o produto em contexto real e finalize com uma chamada clara para o cliente pedir o link.";
}

export async function registerAIRoutes(app: FastifyInstance) {
  app.post("/generate-text", async (request) => {
    const { prompt } = generateTextSchema.parse(request.body);
    return {
      text: buildLocalSuggestion(prompt),
      provider: "local-template",
    };
  });
}
