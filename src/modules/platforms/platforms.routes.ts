import type { FastifyInstance } from "fastify";
import { platformParamSchema } from "./platforms.schemas.js";
import { platformsService } from "./platforms.service.js";

export async function registerPlatformsRoutes(app: FastifyInstance) {
  app.get("/accounts", async () => platformsService.listAccounts());

  app.post("/:platform/connect", async (request) => {
    const { platform } = platformParamSchema.parse(request.params);
    return platformsService.connect(platform);
  });

  app.post("/:platform/disconnect", async (request) => {
    const { platform } = platformParamSchema.parse(request.params);
    return platformsService.disconnect(platform);
  });
}
