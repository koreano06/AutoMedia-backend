import type { FastifyInstance } from "fastify";
import { reportsService } from "./reports.service.js";

export async function registerReportsRoutes(app: FastifyInstance) {
  app.get("/overview", async (request) => reportsService.overview(request.user?.workspace_id));
  app.get("/summary", async (request) => reportsService.overview(request.user?.workspace_id));
  app.get("/platforms", async (request) => reportsService.platforms(request.user?.workspace_id));
}
