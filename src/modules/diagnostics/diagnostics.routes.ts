import type { FastifyInstance } from "fastify";
import { diagnosticsService } from "./diagnostics.service.js";
import { runDiagnosticsChecksSchema } from "./diagnostics.schemas.js";

export async function registerDiagnosticsRoutes(app: FastifyInstance) {
  app.get("/", async () => diagnosticsService.check());
  app.get("/production-checklist", async () => diagnosticsService.productionChecklist());
  app.get("/logs", async () => diagnosticsService.operationalLogs());
  app.post("/run-checks", async (request) => diagnosticsService.runChecks(runDiagnosticsChecksSchema.parse(request.body), request.user));
}
