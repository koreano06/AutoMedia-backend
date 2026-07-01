import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
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
import { registerAIUsageRoutes } from "./modules/ai-usage/ai-usage.routes.js";
import { registerMetaRoutes } from "./modules/meta/meta.routes.js";
import { registerMarketplaceListingsRoutes } from "./modules/marketplace-listings/marketplace-listings.routes.js";
import { registerMarketplaceSearchRoutes } from "./modules/marketplace-search/marketplace-search.routes.js";
import { registerFinanceRoutes } from "./modules/finance/finance.routes.js";
import { registerDiagnosticsRoutes } from "./modules/diagnostics/diagnostics.routes.js";
import { registerActionRoutes } from "./modules/actions/actions.routes.js";
import { authMiddleware } from "./shared/middlewares/auth.middleware.js";
import { rateLimitOptions } from "./shared/middlewares/rate-limit.middleware.js";

export function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
    bodyLimit: env.UPLOAD_BODY_LIMIT_MB * 1024 * 1024,
  });

  app.register(helmet, {
    contentSecurityPolicy: false,
  });
  app.register(rateLimit, rateLimitOptions);
  app.register(cors, corsOptions);
  app.setErrorHandler(errorHandler);
  app.addHook("preHandler", authMiddleware);

  app.get("/health", async () => ({ status: "ok", service: "automedia-backend" }));

  app.register(async (api) => {
    api.get("/health", async () => ({ status: "ok", service: "automedia-api" }));
    api.register(registerActionRoutes);
    api.register(registerMarketplaceListingsRoutes, { prefix: "/marketplace-listings" });
    api.register(registerMarketplaceSearchRoutes, { prefix: "/marketplace-search" });
    api.register(registerFinanceRoutes, { prefix: "/finance" });
    api.register(registerDiagnosticsRoutes, { prefix: "/diagnostics" });
    api.register(registerAIUsageRoutes, { prefix: "/ai-usage" });
    api.register(registerMetaRoutes, { prefix: "/meta" });
    api.register(registerAuthRoutes, { prefix: "/auth" });
    api.register(registerUsersRoutes, { prefix: "/users" });
    api.register(registerProductsRoutes, { prefix: "/products" });
    api.register(registerMediaRoutes, { prefix: "/media-assets" });
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
