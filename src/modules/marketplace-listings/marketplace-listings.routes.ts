import type { FastifyInstance } from "fastify";
import { created } from "../../shared/http/reply.js";
import { marketplaceListingsService } from "./marketplace-listings.service.js";
import { marketplaceListingPayloadSchema, marketplaceListingUpdateSchema } from "./marketplace-listings.schemas.js";

export async function registerMarketplaceListingsRoutes(app: FastifyInstance) {
  app.get("/", async (request) => {
    const query = request.query as { order?: string; limit?: string };
    return marketplaceListingsService.list(query.order, query.limit ? Number(query.limit) : undefined);
  });

  app.post("/", async (request, reply) => {
    return created(reply, await marketplaceListingsService.create(marketplaceListingPayloadSchema.parse(request.body)));
  });

  app.post("/:id/publish-now", async (request) => {
    const { id } = request.params as { id: string };
    return marketplaceListingsService.publishNow(id);
  });

  app.patch("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return marketplaceListingsService.update(id, marketplaceListingUpdateSchema.parse(request.body));
  });

  app.delete("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return marketplaceListingsService.delete(id);
  });
}
