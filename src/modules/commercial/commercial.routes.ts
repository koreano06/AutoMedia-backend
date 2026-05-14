import type { FastifyInstance } from "fastify";
import { commercialService } from "./commercial.service.js";

export async function registerCommercialRoutes(app: FastifyInstance) {
  app.get("/summary", async () => commercialService.summary());
  app.get("/leads", async () => commercialService.leads());
}
