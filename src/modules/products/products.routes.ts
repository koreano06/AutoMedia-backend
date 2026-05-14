import type { FastifyInstance } from "fastify";
import { created, accepted } from "../../shared/http/reply.js";
import { productAnalyzeSchema, productPayloadSchema, productQuerySchema } from "./products.schemas.js";
import { productsService } from "./products.service.js";

export async function registerProductsRoutes(app: FastifyInstance) {
  app.get("/", async (request) => {
    const query = productQuerySchema.parse(request.query);
    return productsService.list(query.order, query.limit);
  });

  app.post("/", async (request, reply) => {
    const payload = productPayloadSchema.parse(request.body);
    return created(reply, productsService.create(payload));
  });

  app.post("/analyze", async (request, reply) => {
    const payload = productAnalyzeSchema.parse(request.body);
    return accepted(reply, productsService.analyze(payload));
  });

  app.patch("/:id", async (request) => {
    const { id } = request.params as { id: string };
    const payload = productPayloadSchema.partial().parse(request.body);
    return productsService.update(id, payload);
  });

  app.delete("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return productsService.delete(id);
  });
}
