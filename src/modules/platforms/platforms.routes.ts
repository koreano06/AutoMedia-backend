import type { FastifyInstance } from "fastify";
import { oauthCallbackSchema, platformParamSchema, publishPayloadSchema } from "./platforms.schemas.js";
import { platformsService } from "./platforms.service.js";

export async function registerPlatformsRoutes(app: FastifyInstance) {
  app.get("/accounts", async () => platformsService.listAccounts());

  app.get("/:platform/connect-url", async (request) => {
    const { platform } = platformParamSchema.parse(request.params);
    return platformsService.getConnectUrl(platform);
  });

  app.post("/:platform/connect", async (request) => {
    const { platform } = platformParamSchema.parse(request.params);
    return platformsService.connect(platform);
  });

  app.get("/:platform/callback", async (request, reply) => {
    const { platform } = platformParamSchema.parse(request.params);
    const result = await platformsService.handleCallback(platform, oauthCallbackSchema.parse(request.query));
    return reply.redirect(result.redirect_url);
  });

  app.post("/:platform/disconnect", async (request) => {
    const { platform } = platformParamSchema.parse(request.params);
    return platformsService.disconnect(platform);
  });

  app.post("/:platform/publish", async (request) => {
    const { platform } = platformParamSchema.parse(request.params);
    return platformsService.publish(platform, publishPayloadSchema.parse(request.body));
  });
}
