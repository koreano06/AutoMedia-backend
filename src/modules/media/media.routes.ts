import type { FastifyInstance } from "fastify";
import { accepted, created } from "../../shared/http/reply.js";
import { collectMediaSchema, mediaAssetPayloadSchema, mediaQuerySchema } from "./media.schemas.js";
import { mediaService } from "./media.service.js";

export async function registerMediaRoutes(app: FastifyInstance) {
  app.get("/", async (request) => mediaService.list(mediaQuerySchema.parse(request.query)));

  app.post("/", async (request, reply) => created(reply, await mediaService.create(mediaAssetPayloadSchema.parse(request.body))));

  app.post("/collect", async (request, reply) => accepted(reply, await mediaService.collect(collectMediaSchema.parse(request.body))));

  app.patch("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return mediaService.update(id, mediaAssetPayloadSchema.partial().parse(request.body));
  });
}
