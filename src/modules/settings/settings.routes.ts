import type { FastifyInstance } from "fastify";
import { automationSettingsSchema } from "./settings.schemas.js";
import { settingsService } from "./settings.service.js";

export async function registerSettingsRoutes(app: FastifyInstance) {
  app.get("/automation", async () => settingsService.getAutomation());
  app.put("/automation", async (request) => settingsService.updateAutomation(automationSettingsSchema.parse(request.body)));
}
