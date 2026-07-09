import type { FastifyInstance } from "fastify";
import { oauthCallbackSchema, platformParamSchema, publishPayloadSchema } from "./platforms.schemas.js";
import { platformsService } from "./platforms.service.js";

export async function registerPlatformsRoutes(app: FastifyInstance) {
  app.get("/accounts", async (request) => platformsService.listAccounts(request.user?.workspace_id));

  app.get("/:platform/connect-url", { config: { rateLimit: { max: 12, timeWindow: "1 minute" } } }, async (request) => {
    const { platform } = platformParamSchema.parse(request.params);
    return platformsService.getConnectUrl(platform, request.user?.workspace_id);
  });

  app.post("/:platform/connect", { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } }, async (request) => {
    const { platform } = platformParamSchema.parse(request.params);
    return platformsService.connect(platform, request.user?.workspace_id);
  });

  app.get("/:platform/callback", async (request, reply) => {
    const { platform } = platformParamSchema.parse(request.params);
    const result = await platformsService.handleCallback(platform, oauthCallbackSchema.parse(request.query));
    return reply.redirect(result.redirect_url);
  });

  app.post("/:platform/disconnect", { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } }, async (request) => {
    const { platform } = platformParamSchema.parse(request.params);
    return platformsService.disconnect(platform, request.user?.workspace_id);
  });

  app.post("/:platform/refresh-token", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request) => {
    const { platform } = platformParamSchema.parse(request.params);
    return platformsService.refresh(platform, request.user?.workspace_id);
  });

  app.post("/:platform/sync-account", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request) => {
    const { platform } = platformParamSchema.parse(request.params);
    return platformsService.syncAccount(platform, request.user?.workspace_id);
  });

  app.post("/:platform/publish", { config: { rateLimit: { max: 6, timeWindow: "1 minute" } } }, async (request) => {
    const { platform } = platformParamSchema.parse(request.params);
    return platformsService.publish(platform, publishPayloadSchema.parse(request.body), request.user?.workspace_id);
  });
}
