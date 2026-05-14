import type { FastifyInstance } from "fastify";
import { created } from "../../shared/http/reply.js";
import { autoReplySchema, commentPayloadSchema } from "./comments.schemas.js";
import { commentsService } from "./comments.service.js";

export async function registerCommentsRoutes(app: FastifyInstance) {
  app.get("/", async (request) => {
    const query = request.query as { order?: string; limit?: string };
    return commentsService.list(query.order, query.limit ? Number(query.limit) : undefined);
  });

  app.post("/", async (request, reply) => created(reply, commentsService.create(commentPayloadSchema.parse(request.body))));

  app.post("/auto-reply", async (request) => commentsService.autoReply(autoReplySchema.parse(request.body)));

  app.patch("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return commentsService.update(id, commentPayloadSchema.partial().parse(request.body));
  });
}
