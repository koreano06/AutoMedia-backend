import type { FastifyInstance } from "fastify";
import { created } from "../../shared/http/reply.js";
import { postPayloadSchema, schedulePostSchema } from "./posts.schemas.js";
import { postsService } from "./posts.service.js";

export async function registerPostsRoutes(app: FastifyInstance) {
  app.get("/", async (request) => {
    const query = request.query as { order?: string; limit?: string };
    return postsService.list(query.order, query.limit ? Number(query.limit) : undefined);
  });

  app.post("/", async (request, reply) => created(reply, await postsService.create(postPayloadSchema.parse(request.body))));

  app.post("/schedule", async (request, reply) => created(reply, await postsService.schedule(schedulePostSchema.parse(request.body))));

  app.post("/:id/publish-now", async (request) => {
    const { id } = request.params as { id: string };
    return postsService.publishNow(id);
  });

  app.patch("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return postsService.update(id, postPayloadSchema.partial().parse(request.body));
  });

  app.delete("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return postsService.delete(id);
  });
}
