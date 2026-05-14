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

export function buildApp() {
  const app = Fastify({ logger: env.NODE_ENV !== "test" });

  app.register(cors, corsOptions);
  app.setErrorHandler(errorHandler);

  app.get("/health", async () => ({ status: "ok", service: "automedia-backend" }));

  app.register(async (api) => {
    api.get("/health", async () => ({ status: "ok", service: "automedia-api" }));
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
