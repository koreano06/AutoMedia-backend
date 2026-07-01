import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "../../shared/errors/AppError.js";
import { oauthCallbackQuerySchema } from "../platforms/platforms.schemas.js";
import { platformsService } from "../platforms/platforms.service.js";
import { postsService } from "../posts/posts.service.js";
import { productsService } from "../products/products.service.js";
import { mediaService } from "../media/media.service.js";
import { videosService } from "../videos/videos.service.js";
import { commentsService } from "../comments/comments.service.js";
import { mediaRepository } from "../media/media.repository.js";
import {
  commentAutoReplyActionSchema,
  commentUpdateActionSchema,
  mediaCollectActionSchema,
  mediaUpdateActionSchema,
  platformActionSchema,
  platformPublishActionSchema,
  postDeleteActionSchema,
  postPublishDueActionSchema,
  postPublishNowActionSchema,
  postUpdateActionSchema,
  productAnalyzeActionSchema,
  productDeleteActionSchema,
  productImageUploadActionSchema,
  productUpdateActionSchema,
  videoGenerateActionSchema,
} from "./actions.schemas.js";

function authContext(request: FastifyRequest) {
  if (!request.user?.id) {
    throw new AppError("Autenticação obrigatória", 401, "AUTH_REQUIRED");
  }

  if (!request.user.workspace_id) {
    throw new AppError("Workspace obrigatório no token", 401, "WORKSPACE_REQUIRED");
  }

  return {
    userId: request.user.id,
    workspaceId: request.user.workspace_id,
    role: request.user.role,
  };
}

function requireAdminContext(request: FastifyRequest) {
  const context = authContext(request);
  if (context.role !== "admin") {
    throw new AppError("Permissão insuficiente", 403, "FORBIDDEN");
  }

  return context;
}

export async function registerActionRoutes(app: FastifyInstance) {
  app.get("/platform-accounts", async (request) => {
    const { workspaceId } = authContext(request);
    return platformsService.listAccounts(workspaceId);
  });

  app.get("/platform-callback", async (request, reply) => {
    const { platform, ...query } = oauthCallbackQuerySchema.parse(request.query);
    const result = await platformsService.handleCallback(platform, query);
    return reply.redirect(result.redirect_url);
  });

  app.post("/product-analyze", async (request) => {
    const { userId, workspaceId } = authContext(request);
    return productsService.analyze(productAnalyzeActionSchema.parse(request.body), userId, workspaceId);
  });

  app.post("/product-update", async (request) => {
    const { workspaceId } = authContext(request);
    const { id, ...payload } = productUpdateActionSchema.parse(request.body);
    return productsService.update(id, payload, workspaceId);
  });

  app.post("/product-delete", async (request) => {
    const { userId, workspaceId } = requireAdminContext(request);
    const { id } = productDeleteActionSchema.parse(request.body);
    return productsService.delete(id, userId, workspaceId);
  });

  app.post("/media-collect", async (request) => {
    const { workspaceId } = authContext(request);
    return mediaService.collect(mediaCollectActionSchema.parse(request.body), workspaceId);
  });

  app.post("/media-update", async (request) => {
    const { userId, workspaceId } = authContext(request);
    const { id, ...payload } = mediaUpdateActionSchema.parse(request.body);
    return mediaService.update(id, payload, workspaceId, userId);
  });

  app.post("/video-generate", async (request) => {
    const { userId, workspaceId } = authContext(request);
    return videosService.generate(videoGenerateActionSchema.parse(request.body), workspaceId, userId);
  });

  app.post("/product-image-upload", async (request) => {
    const { workspaceId } = authContext(request);
    const body = productImageUploadActionSchema.parse(request.body || {});

    const asset = await mediaRepository.create({
      product_id: body.product_id,
      workspace_id: workspaceId,
      product_name: body.product_name,
      type: "image",
      title: body.title || "Imagem de produto enviada",
      status: "pending_review",
      source: "Upload local",
      url: body.url,
      thumbnail_url: body.thumbnail_url || body.url,
      storage_key: `product-images/${Date.now()}.png`,
      mime_type: body.mime_type,
      file_size: body.file_size,
    });

    return { asset };
  });

  app.post("/comment-auto-reply", async (request) => {
    const { workspaceId } = authContext(request);
    return commentsService.autoReply(commentAutoReplyActionSchema.parse(request.body), workspaceId);
  });

  app.post("/comment-update", async (request) => {
    const { workspaceId } = authContext(request);
    const { id, ...payload } = commentUpdateActionSchema.parse(request.body);
    return commentsService.update(id, payload, workspaceId);
  });

  app.post("/platform-connect", async (request) => {
    const { workspaceId } = requireAdminContext(request);
    const { platform } = platformActionSchema.parse(request.body);
    return platformsService.connect(platform, workspaceId);
  });

  app.post("/platform-disconnect", async (request) => {
    const { workspaceId } = requireAdminContext(request);
    const { platform } = platformActionSchema.parse(request.body);
    return platformsService.disconnect(platform, workspaceId);
  });

  app.post("/platform-refresh-token", async (request) => {
    const { workspaceId } = requireAdminContext(request);
    const { platform } = platformActionSchema.parse(request.body);
    return platformsService.refresh(platform, workspaceId);
  });

  app.post("/platform-sync-account", async (request) => {
    const { workspaceId } = requireAdminContext(request);
    const { platform } = platformActionSchema.parse(request.body);
    return platformsService.syncAccount(platform, workspaceId);
  });

  app.post("/platform-publish", async (request) => {
    const { workspaceId } = requireAdminContext(request);
    const { platform, ...payload } = platformPublishActionSchema.parse(request.body);
    return platformsService.publish(platform, payload, workspaceId);
  });

  app.post("/post-publish-now", async (request) => {
    const { userId, workspaceId } = requireAdminContext(request);
    const { id } = postPublishNowActionSchema.parse(request.body);
    return postsService.publishNow(id, workspaceId, userId);
  });

  app.post("/post-publish-due", async (request) => {
    const { workspaceId } = requireAdminContext(request);
    return postsService.publishDue(postPublishDueActionSchema.parse(request.body || {}), workspaceId);
  });

  app.post("/post-update", async (request) => {
    const { userId, workspaceId } = authContext(request);
    const { id, ...payload } = postUpdateActionSchema.parse(request.body);
    return postsService.update(id, payload, workspaceId, userId);
  });

  app.post("/post-delete", async (request) => {
    const { userId, workspaceId } = requireAdminContext(request);
    const { id } = postDeleteActionSchema.parse(request.body);
    return postsService.delete(id, workspaceId, userId);
  });
}
