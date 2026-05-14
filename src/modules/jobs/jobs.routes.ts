import type { FastifyInstance } from "fastify";
import { created } from "../../shared/http/reply.js";
import { createJobSchema, updateJobSchema } from "./jobs.schemas.js";
import { jobsService } from "./jobs.service.js";

export async function registerJobsRoutes(app: FastifyInstance) {
  app.get("/", async () => jobsService.list());

  app.get("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return jobsService.get(id);
  });

  app.post("/", async (request, reply) => created(reply, jobsService.create(createJobSchema.parse(request.body))));

  app.patch("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return jobsService.update(id, updateJobSchema.parse(request.body));
  });
}
