import type { FastifyInstance } from "fastify";
import { commercialService } from "./commercial.service.js";

export async function registerCommercialRoutes(app: FastifyInstance) {
  app.get("/summary", async (request) => commercialService.summary(request.user?.workspace_id));
  app.get("/leads", async (request) => commercialService.leads(request.user?.workspace_id));
}
