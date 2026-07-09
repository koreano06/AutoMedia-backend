import type { FastifyInstance } from "fastify";
import { accepted } from "../../shared/http/reply.js";
import { generateVideoSchema } from "./videos.schemas.js";
import { videosService } from "./videos.service.js";

export async function registerVideosRoutes(app: FastifyInstance) {
  app.post("/generate", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => accepted(reply, await videosService.generate(generateVideoSchema.parse(request.body), request.user?.workspace_id, request.user?.id)));
}
