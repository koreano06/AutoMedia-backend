import type { FastifyInstance } from "fastify";
import { diagnosticsService } from "./diagnostics.service.js";

export async function registerDiagnosticsRoutes(app: FastifyInstance) {
  app.get("/", async () => diagnosticsService.check());
}
