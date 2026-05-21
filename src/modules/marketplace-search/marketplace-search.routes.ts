import type { FastifyInstance } from "fastify";
import { marketplaceSearchQuerySchema } from "./marketplace-search.schemas.js";
import { marketplaceSearchService } from "./marketplace-search.service.js";

export async function registerMarketplaceSearchRoutes(app: FastifyInstance) {
  app.get("/", async (request) => marketplaceSearchService.search(marketplaceSearchQuerySchema.parse(request.query)));
}
