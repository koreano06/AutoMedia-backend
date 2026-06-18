import type { FastifyInstance } from "fastify";
import { accepted, created } from "../../shared/http/reply.js";
import { collectMediaSchema, mediaAssetPayloadSchema, mediaQuerySchema } from "./media.schemas.js";
import { mediaService } from "./media.service.js";

export async function registerMediaRoutes(app: FastifyInstance) {
  app.get("/", async (request) => mediaService.list({ ...mediaQuerySchema.parse(request.query), workspace_id: request.user?.workspace_id }));

  app.post("/", async (request, reply) => created(reply, await mediaService.create(mediaAssetPayloadSchema.parse(request.body), request.user?.workspace_id, request.user?.id)));

  app.post("/collect", async (request, reply) => accepted(reply, await mediaService.collect(collectMediaSchema.parse(request.body), request.user?.workspace_id)));

  app.patch("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return mediaService.update(id, mediaAssetPayloadSchema.partial().parse(request.body), request.user?.workspace_id, request.user?.id);
  });
}
