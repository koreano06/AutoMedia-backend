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
import { registerMetaRoutes } from "./modules/meta/meta.routes.js";
import { registerMarketplaceListingsRoutes } from "./modules/marketplace-listings/marketplace-listings.routes.js";
import { registerMarketplaceSearchRoutes } from "./modules/marketplace-search/marketplace-search.routes.js";
import { registerFinanceRoutes } from "./modules/finance/finance.routes.js";
import { registerDiagnosticsRoutes } from "./modules/diagnostics/diagnostics.routes.js";
import { platformsService } from "./modules/platforms/platforms.service.js";
import { postsService } from "./modules/posts/posts.service.js";
import { productsService } from "./modules/products/products.service.js";
import { mediaService } from "./modules/media/media.service.js";
import { videosService } from "./modules/videos/videos.service.js";
import { commentsService } from "./modules/comments/comments.service.js";
import { mediaRepository } from "./modules/media/media.repository.js";
import { oauthCallbackQuerySchema } from "./modules/platforms/platforms.schemas.js";
import { authMiddleware } from "./shared/middlewares/auth.middleware.js";
import { rateLimitOptions } from "./shared/middlewares/rate-limit.middleware.js";
import { AppError } from "./shared/errors/AppError.js";

function assertAdmin(request: { user?: { role: string } }) {
  if (request.user?.role !== "admin") {
    throw new AppError("Permissão insuficiente", 403, "FORBIDDEN");
  }
}

export function buildApp() {
  const app = Fastify({ logger: env.NODE_ENV !== "test" });

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
    api.get("/platform-accounts", async (request) => platformsService.listAccounts(request.user?.workspace_id));
    api.get("/platform-callback", async (request, reply) => {
      const { platform, ...query } = oauthCallbackQuerySchema.parse(request.query);
      const result = await platformsService.handleCallback(platform, query);
      return reply.redirect(result.redirect_url);
    });
    api.post("/product-analyze", async (request) => {
      return productsService.analyze(request.body as { product_id?: string; source_url?: string; image_asset_id?: string }, request.user?.id, request.user?.workspace_id);
    });
    api.post("/product-update", async (request) => {
      const { id, ...payload } = request.body as { id: string; [key: string]: unknown };
      return productsService.update(id, payload, request.user?.workspace_id);
    });
    api.post("/product-delete", async (request) => {
      assertAdmin(request);
      const { id } = request.body as { id: string };
      return productsService.delete(id, request.user?.id, request.user?.workspace_id);
    });
    api.post("/media-collect", async (request) => {
      return mediaService.collect(request.body as { product_id: string; query?: string; sources: string[] }, request.user?.workspace_id);
    });
    api.post("/media-update", async (request) => {
      const { id, ...payload } = request.body as { id: string; [key: string]: unknown };
      return mediaService.update(id, payload, request.user?.workspace_id);
    });
    api.post("/video-generate", async (request) => {
      return videosService.generate(request.body as { product_id: string; media_asset_ids: string[]; style: string; duration: string; briefing?: string; platform?: string }, request.user?.workspace_id);
    });
    api.post("/product-image-upload", async (request) => {
      const body = (request.body || {}) as {
        product_id?: string;
        product_name?: string;
        title?: string;
        url?: string;
        thumbnail_url?: string;
        mime_type?: string;
        file_size?: number;
      };

      const asset = await mediaRepository.create({
        product_id: body.product_id,
        workspace_id: request.user?.workspace_id,
        product_name: body.product_name,
        type: "image",
        title: body.title || "Imagem de produto enviada",
        status: "collected",
        source: "upload",
        url: body.url || "/uploads/product-image-placeholder.png",
        thumbnail_url: body.thumbnail_url || body.url || "/uploads/product-image-placeholder.png",
        storage_key: `product-images/${Date.now()}.png`,
        mime_type: body.mime_type || "image/png",
        file_size: body.file_size,
      });

      return { asset };
    });
    api.post("/comment-auto-reply", async (request) => {
      return commentsService.autoReply(request.body as { comment_id: string; product_id?: string; reply_template: string });
    });
    api.post("/comment-update", async (request) => {
      const { id, ...payload } = request.body as { id: string; [key: string]: unknown };
      return commentsService.update(id, payload);
    });
    api.post("/platform-connect", async (request) => {
      assertAdmin(request);
      const { platform } = request.body as { platform: string };
      return platformsService.connect(platform, request.user?.workspace_id);
    });
    api.post("/platform-disconnect", async (request) => {
      assertAdmin(request);
      const { platform } = request.body as { platform: string };
      return platformsService.disconnect(platform, request.user?.workspace_id);
    });
    api.post("/platform-refresh-token", async (request) => {
      assertAdmin(request);
      const { platform } = request.body as { platform: string };
      return platformsService.refresh(platform, request.user?.workspace_id);
    });
    api.post("/platform-sync-account", async (request) => {
      assertAdmin(request);
      const { platform } = request.body as { platform: string };
      return platformsService.syncAccount(platform, request.user?.workspace_id);
    });
    api.post("/platform-publish", async (request) => {
      assertAdmin(request);
      const { platform, ...payload } = request.body as { platform: string; [key: string]: unknown };
      return platformsService.publish(platform, {
        post_id: payload.post_id as string | undefined,
        media_asset_id: payload.media_asset_id as string | undefined,
        product_name: payload.product_name as string | undefined,
        title: payload.title as string | undefined,
        caption: String(payload.caption || ""),
        media_url: payload.media_url as string | undefined,
        mime_type: payload.mime_type as string | undefined,
        thumbnail_url: payload.thumbnail_url as string | undefined,
        scheduled_at: payload.scheduled_at as string | undefined,
      }, request.user?.workspace_id);
    });
    api.register(registerMarketplaceListingsRoutes, { prefix: "/marketplace-listings" });
    api.register(registerMarketplaceSearchRoutes, { prefix: "/marketplace-search" });
    api.register(registerFinanceRoutes, { prefix: "/finance" });
    api.register(registerDiagnosticsRoutes, { prefix: "/diagnostics" });
    api.post("/post-publish-now", async (request) => {
      assertAdmin(request);
      const { id } = request.body as { id: string };
      return postsService.publishNow(id, request.user?.workspace_id);
    });
    api.post("/post-update", async (request) => {
      const { id, ...payload } = request.body as { id: string; [key: string]: unknown };
      return postsService.update(id, payload, request.user?.workspace_id);
    });
    api.post("/post-delete", async (request) => {
      assertAdmin(request);
      const { id } = request.body as { id: string };
      return postsService.delete(id, request.user?.workspace_id);
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
