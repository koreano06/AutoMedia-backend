import type { FastifyInstance } from "fastify";
import { created, accepted } from "../../shared/http/reply.js";
import { productAnalyzeSchema, productPayloadSchema, productQuerySchema } from "./products.schemas.js";
import { productsService } from "./products.service.js";
import { requireRole } from "../../shared/middlewares/auth.middleware.js";

export async function registerProductsRoutes(app: FastifyInstance) {
  app.get("/", async (request) => {
    const query = productQuerySchema.parse(request.query);
    return productsService.list(query.order, query.limit, request.user?.workspace_id);
  });

  app.post("/", async (request, reply) => {
    const payload = productPayloadSchema.parse(request.body);
    return created(reply, await productsService.create(payload, request.user?.id, request.user?.workspace_id));
  });

  app.post("/analyze", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const payload = productAnalyzeSchema.parse(request.body);
    return accepted(reply, await productsService.analyze(payload, request.user?.id, request.user?.workspace_id));
  });

  app.patch("/:id", async (request) => {
    const { id } = request.params as { id: string };
    const payload = productPayloadSchema.partial().parse(request.body);
    return productsService.update(id, payload, request.user?.workspace_id);
  });

  app.delete("/:id", { preHandler: requireRole(["admin"]) }, async (request) => {
    const { id } = request.params as { id: string };
    return productsService.delete(id, request.user?.id, request.user?.workspace_id);
  });
}
