import type { FastifyInstance } from "fastify";
import { reportsService } from "./reports.service.js";

export async function registerReportsRoutes(app: FastifyInstance) {
  app.get("/overview", async () => reportsService.overview());
  app.get("/platforms", async () => reportsService.platforms());
}
