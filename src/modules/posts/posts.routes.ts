import type { FastifyInstance } from "fastify";
import { created } from "../../shared/http/reply.js";
import { requireRole } from "../../shared/middlewares/auth.middleware.js";
import { postPayloadSchema, publishDuePostsSchema, schedulePostSchema } from "./posts.schemas.js";
import { postsService } from "./posts.service.js";

export async function registerPostsRoutes(app: FastifyInstance) {
  app.get("/", async (request) => {
    const query = request.query as { order?: string; limit?: string };
    return postsService.list(query.order, query.limit ? Number(query.limit) : undefined, request.user?.workspace_id);
  });

  app.post("/", async (request, reply) => created(reply, await postsService.create(postPayloadSchema.parse(request.body), request.user?.workspace_id, request.user?.id)));

  app.post("/schedule", async (request, reply) => created(reply, await postsService.schedule(schedulePostSchema.parse(request.body), request.user?.workspace_id, request.user?.id)));

  app.post("/publish-due", { preHandler: requireRole(["admin"]) }, async (request) => {
    return postsService.publishDue(publishDuePostsSchema.parse(request.body || {}), request.user?.workspace_id);
  });

  app.post("/:id/publish-now", { preHandler: requireRole(["admin"]) }, async (request) => {
    const { id } = request.params as { id: string };
    return postsService.publishNow(id, request.user?.workspace_id, request.user?.id);
  });

  app.patch("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return postsService.update(id, postPayloadSchema.partial().parse(request.body), request.user?.workspace_id, request.user?.id);
  });

  app.delete("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return postsService.delete(id, request.user?.workspace_id, request.user?.id);
  });
}
