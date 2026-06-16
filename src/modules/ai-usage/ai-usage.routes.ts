import type { FastifyInstance } from "fastify";
import { aiUsageService } from "./ai-usage.service.js";

export async function registerAIUsageRoutes(app: FastifyInstance) {
  app.get("/summary", async (request) => aiUsageService.summary(request.user?.workspace_id));
}
