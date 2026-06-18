import { mediaRepository } from "../media/media.repository.js";
import { postsRepository } from "./posts.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { nowIso } from "../../shared/utils/dates.js";
import type { Post } from "../../shared/types/domain.js";
import { platformsService } from "../platforms/platforms.service.js";
import { prisma } from "../../database/prisma.js";
import { auditService } from "../audit/audit.service.js";

function randomScheduleDate() {
  const date = new Date();
  date.setHours(Math.floor(Math.random() * 14) + 8, Math.floor(Math.random() * 60), 0, 0);
  return date.toISOString();
}

export const postsService = {
  list(order = "-created_at", limit?: number, workspaceId?: string) {
    if (workspaceId) return postsRepository.filter({ workspace_id: workspaceId }, order, limit);
    return postsRepository.list(order, limit);
  },

  async create(payload: Partial<Post>, workspaceId?: string, actorId?: string) {
    const post = await postsRepository.create({ status: payload.status || "scheduled", workspace_id: workspaceId, ...payload });
    await auditService.log({ actor_id: actorId, action: "post.create", entity_type: "post", entity_id: post.id, after: post });
    return post;
  },

  async update(id: string, payload: Partial<Post>, workspaceId?: string, actorId?: string) {
    const post = await postsRepository.findById(id);
    if (!post) throw new AppError("Post não encontrado", 404, "POST_NOT_FOUND");
    if (workspaceId && post.workspace_id && post.workspace_id !== workspaceId) throw new AppError("Post não pertence a este workspace", 403, "WORKSPACE_FORBIDDEN");
    const updated = await postsRepository.update(id, payload);
    await auditService.log({ actor_id: actorId, action: "post.update", entity_type: "post", entity_id: id, before: post, after: updated });
    return updated;
  },

  async delete(id: string, workspaceId?: string, actorId?: string) {
    const post = await postsRepository.findById(id);
    if (!post) throw new AppError("Post não encontrado", 404, "POST_NOT_FOUND");
    if (workspaceId && post.workspace_id && post.workspace_id !== workspaceId) throw new AppError("Post não pertence a este workspace", 403, "WORKSPACE_FORBIDDEN");
    const deleted = await postsRepository.delete(id);
    await auditService.log({ actor_id: actorId, action: "post.delete", entity_type: "post", entity_id: id, before: post });
    return deleted;
  },

  async schedule(payload: { media_asset_id: string; platforms: string[]; caption: string; schedule_mode: "now" | "scheduled" | "random_window"; scheduled_at?: string }, workspaceId?: string, actorId?: string) {
    const asset = await mediaRepository.findById(payload.media_asset_id);
    if (!asset) throw new AppError("Mídia não encontrada para agendamento", 404, "MEDIA_NOT_FOUND");
    if (workspaceId && asset.workspace_id && asset.workspace_id !== workspaceId) throw new AppError("Mídia não pertence a este workspace", 403, "WORKSPACE_FORBIDDEN");

    const posts = await Promise.all(payload.platforms.map((platform) => postsRepository.create({
      media_asset_id: asset.id,
      workspace_id: workspaceId || asset.workspace_id,
      product_id: asset.product_id,
      product_name: asset.product_name,
      platform,
      caption: payload.caption || asset.caption,
      status: payload.schedule_mode === "now" ? "published" : "scheduled",
      scheduled_at: payload.schedule_mode === "random_window" ? randomScheduleDate() : payload.scheduled_at,
      published_at: payload.schedule_mode === "now" ? nowIso() : undefined,
      thumbnail_url: asset.thumbnail_url || asset.url,
      engagement_likes: 0,
      engagement_comments: 0,
      engagement_shares: 0,
      engagement_reach: 0,
    })));
    await auditService.log({
      actor_id: actorId,
      action: "post.schedule",
      entity_type: "media_asset",
      entity_id: asset.id,
      metadata: { post_ids: posts.map((post) => post.id), platforms: payload.platforms, schedule_mode: payload.schedule_mode },
    });
    return posts;
  },

  async publishNow(id: string, workspaceId?: string, actorId?: string) {
    const post = await postsRepository.findById(id);
    if (!post) throw new AppError("Post não encontrado", 404, "POST_NOT_FOUND");
    if (workspaceId && post.workspace_id && post.workspace_id !== workspaceId) throw new AppError("Post não pertence a este workspace", 403, "WORKSPACE_FORBIDDEN");
    if (!post.platform) throw new AppError("Post sem plataforma definida", 400, "POST_PLATFORM_MISSING");

    const result = await platformsService.publish(post.platform, {
      post_id: post.id,
      media_asset_id: post.media_asset_id,
      product_name: post.product_name,
      title: post.product_name,
      caption: post.caption || "",
      media_url: post.thumbnail_url,
    }, workspaceId || post.workspace_id);

    const updated = await postsRepository.update(id, {
      status: result.status,
      published_at: result.status === "published" ? nowIso() : post.published_at,
      external_post_id: result.external_post_id,
      external_url: result.external_url,
      error_message: result.status === "failed" ? result.message : undefined,
      retry_count: (post.retry_count || 0) + 1,
      last_sync_at: nowIso(),
    });
    await auditService.log({
      actor_id: actorId,
      action: "post.publish_now",
      entity_type: "post",
      entity_id: id,
      before: post,
      after: updated,
      metadata: { platform: post.platform, status: result.status },
    });
    return updated;
  },

  async publishDue(payload: { limit?: number; dry_run?: boolean } = {}, workspaceId?: string) {
    const limit = Math.min(Math.max(payload.limit || 25, 1), 100);
    const duePosts = await prisma.post.findMany({
      where: {
        status: "scheduled",
        scheduledAt: { lte: new Date() },
        ...(workspaceId ? { workspaceId } : {}),
      },
      orderBy: { scheduledAt: "asc" },
      take: limit,
    });

    if (payload.dry_run) {
      return {
        dry_run: true,
        total: duePosts.length,
        posts: duePosts.map((post) => ({
          id: post.id,
          platform: post.platform,
          product_name: post.productName,
          scheduled_at: post.scheduledAt?.toISOString(),
        })),
      };
    }

    const results = [];

    for (const post of duePosts) {
      try {
        await postsRepository.update(post.id, {
          status: "publishing",
          last_sync_at: nowIso(),
        });

        const published = await this.publishNow(post.id, workspaceId || post.workspaceId || undefined);
        results.push({
          id: post.id,
          platform: post.platform,
          status: published.status,
          external_post_id: published.external_post_id,
          external_url: published.external_url,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao publicar post agendado";
        await postsRepository.update(post.id, {
          status: "failed",
          error_message: message,
          retry_count: post.retryCount + 1,
          last_sync_at: nowIso(),
        });
        results.push({
          id: post.id,
          platform: post.platform,
          status: "failed",
          error_message: message,
        });
      }
    }

    return {
      dry_run: false,
      total: duePosts.length,
      published: results.filter((item) => item.status === "published" || item.status === "publishing").length,
      failed: results.filter((item) => item.status === "failed").length,
      results,
    };
  },
};
