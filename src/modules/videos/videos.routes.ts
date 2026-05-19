import type { FastifyInstance } from "fastify";
import { accepted } from "../../shared/http/reply.js";
import { generateVideoSchema } from "./videos.schemas.js";
import { videosService } from "./videos.service.js";

export async function registerVideosRoutes(app: FastifyInstance) {
  app.post("/generate", async (request, reply) => accepted(reply, await videosService.generate(generateVideoSchema.parse(request.body))));
}
