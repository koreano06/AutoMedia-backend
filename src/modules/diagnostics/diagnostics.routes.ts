import type { FastifyInstance } from "fastify";
import { diagnosticsService } from "./diagnostics.service.js";
import { runDiagnosticsChecksSchema } from "./diagnostics.schemas.js";

export async function registerDiagnosticsRoutes(app: FastifyInstance) {
  app.get("/", async () => diagnosticsService.check());
  app.post("/run-checks", async (request) => diagnosticsService.runChecks(runDiagnosticsChecksSchema.parse(request.body), request.user));
}
