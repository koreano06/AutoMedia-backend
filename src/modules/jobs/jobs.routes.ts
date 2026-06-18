import type { FastifyInstance } from "fastify";
import { created } from "../../shared/http/reply.js";
import { createJobSchema, updateJobSchema } from "./jobs.schemas.js";
import { jobsService } from "./jobs.service.js";

export async function registerJobsRoutes(app: FastifyInstance) {
  app.get("/", async (request) => jobsService.list(request.user?.workspace_id));

  app.get("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return jobsService.get(id, request.user?.workspace_id);
  });

  app.post("/", async (request, reply) => created(reply, await jobsService.create(createJobSchema.parse(request.body), request.user?.workspace_id)));

  app.patch("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return jobsService.update(id, updateJobSchema.parse(request.body), request.user?.workspace_id);
  });

  app.post("/:id/retry", async (request) => {
    const { id } = request.params as { id: string };
    return jobsService.retry(id, request.user?.workspace_id, request.user?.id);
  });

  app.delete("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return jobsService.delete(id, request.user?.workspace_id);
  });
}
