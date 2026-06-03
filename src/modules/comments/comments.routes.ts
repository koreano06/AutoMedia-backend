import type { FastifyInstance } from "fastify";
import { created } from "../../shared/http/reply.js";
import { autoReplySchema, commentPayloadSchema } from "./comments.schemas.js";
import { commentsService } from "./comments.service.js";

export async function registerCommentsRoutes(app: FastifyInstance) {
  app.get("/", async (request) => {
    const query = request.query as { order?: string; limit?: string };
    return commentsService.list(query.order, query.limit ? Number(query.limit) : undefined, request.user?.workspace_id);
  });

  app.post("/", async (request, reply) => created(reply, await commentsService.create(commentPayloadSchema.parse(request.body), request.user?.workspace_id)));

  app.post("/auto-reply", async (request) => commentsService.autoReply(autoReplySchema.parse(request.body), request.user?.workspace_id));

  app.patch("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return commentsService.update(id, commentPayloadSchema.partial().parse(request.body), request.user?.workspace_id);
  });

  app.delete("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return commentsService.delete(id, request.user?.workspace_id);
  });
}
