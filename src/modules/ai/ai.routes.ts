import type { FastifyInstance } from "fastify";
import { aiService } from "./ai.service.js";
import { generateImageSchema, generateTextSchema } from "./ai.schemas.js";

export async function registerAIRoutes(app: FastifyInstance) {
  app.post("/generate-text", async (request) => {
    const { prompt } = generateTextSchema.parse(request.body);
    return aiService.generateText(prompt);
  });

  app.post("/generate-image", async (request) => {
    return aiService.generateImage(generateImageSchema.parse(request.body));
  });
}
