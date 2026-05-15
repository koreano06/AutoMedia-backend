import cors from "@fastify/cors";
import Fastify from "fastify";
import { corsOptions } from "./config/cors.js";
import { env } from "./config/env.js";
import { errorHandler } from "./shared/errors/error-handler.js";
import { registerAuthRoutes } from "./modules/auth/auth.routes.js";
import { registerUsersRoutes } from "./modules/users/users.routes.js";
import { registerProductsRoutes } from "./modules/products/products.routes.js";
import { registerMediaRoutes } from "./modules/media/media.routes.js";
import { registerVideosRoutes } from "./modules/videos/videos.routes.js";
import { registerApprovalsRoutes } from "./modules/approvals/approvals.routes.js";
import { registerPostsRoutes } from "./modules/posts/posts.routes.js";
import { registerCommentsRoutes } from "./modules/comments/comments.routes.js";
import { registerPlatformsRoutes } from "./modules/platforms/platforms.routes.js";
import { registerJobsRoutes } from "./modules/jobs/jobs.routes.js";
import { registerSettingsRoutes } from "./modules/settings/settings.routes.js";
import { registerReportsRoutes } from "./modules/reports/reports.routes.js";
import { registerCommercialRoutes } from "./modules/commercial/commercial.routes.js";
import { registerUploadsRoutes } from "./modules/media/uploads.routes.js";
import { registerAIRoutes } from "./modules/ai/ai.routes.js";
import { registerMetaRoutes } from "./modules/meta/meta.routes.js";
import { platformsService } from "./modules/platforms/platforms.service.js";
import { postsService } from "./modules/posts/posts.service.js";

export function buildApp() {
  const app = Fastify({ logger: env.NODE_ENV !== "test" });

  app.register(cors, corsOptions);
  app.setErrorHandler(errorHandler);

  app.get("/health", async () => ({ status: "ok", service: "automedia-backend" }));

  app.register(async (api) => {
    api.get("/health", async () => ({ status: "ok", service: "automedia-api" }));
    api.get("/platform-accounts", async () => platformsService.listAccounts());
    api.post("/platform-connect", async (request) => {
      const { platform } = request.body as { platform: string };
      return platformsService.connect(platform);
    });
    api.post("/platform-disconnect", async (request) => {
      const { platform } = request.body as { platform: string };
      return platformsService.disconnect(platform);
    });
    api.post("/platform-publish", async (request) => {
      const { platform, ...payload } = request.body as { platform: string; [key: string]: unknown };
      return platformsService.publish(platform, {
        post_id: payload.post_id as string | undefined,
        media_asset_id: payload.media_asset_id as string | undefined,
        product_name: payload.product_name as string | undefined,
        caption: String(payload.caption || ""),
        media_url: payload.media_url as string | undefined,
        thumbnail_url: payload.thumbnail_url as string | undefined,
        scheduled_at: payload.scheduled_at as string | undefined,
      });
    });
    api.post("/post-publish-now", async (request) => {
      const { id } = request.body as { id: string };
      return postsService.publishNow(id);
    });
    api.register(registerMetaRoutes, { prefix: "/meta" });
    api.register(registerAuthRoutes, { prefix: "/auth" });
    api.register(registerUsersRoutes, { prefix: "/users" });
    api.register(registerProductsRoutes, { prefix: "/products" });
    api.register(registerMediaRoutes, { prefix: "/media-assets" });
    api.register(registerMediaRoutes, { prefix: "/media" });
    api.register(registerUploadsRoutes, { prefix: "/uploads" });
    api.register(registerVideosRoutes, { prefix: "/videos" });
    api.register(registerApprovalsRoutes, { prefix: "/media" });
    api.register(registerPostsRoutes, { prefix: "/posts" });
    api.register(registerCommentsRoutes, { prefix: "/comments" });
    api.register(registerPlatformsRoutes, { prefix: "/platforms" });
    api.register(registerJobsRoutes, { prefix: "/jobs" });
    api.register(registerSettingsRoutes, { prefix: "/settings" });
    api.register(registerReportsRoutes, { prefix: "/reports" });
    api.register(registerCommercialRoutes, { prefix: "/commercial" });
    api.register(registerAIRoutes, { prefix: "/ai" });
  }, { prefix: "/api" });

  return app;
}
