import { mediaRepository } from "../media/media.repository.js";
import { postsRepository } from "./posts.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { nowIso } from "../../shared/store/in-memory-db.js";
import type { Post } from "../../shared/types/domain.js";
import { platformsService } from "../platforms/platforms.service.js";

function randomScheduleDate() {
  const date = new Date();
  date.setHours(Math.floor(Math.random() * 14) + 8, Math.floor(Math.random() * 60), 0, 0);
  return date.toISOString();
}

export const postsService = {
  list(order = "-created_at", limit?: number) {
    return postsRepository.list(order, limit);
  },

  create(payload: Partial<Post>) {
    return postsRepository.create({ status: payload.status || "scheduled", ...payload });
  },

  update(id: string, payload: Partial<Post>) {
    return postsRepository.update(id, payload);
  },

  delete(id: string) {
    return postsRepository.delete(id);
  },

  schedule(payload: { media_asset_id: string; platforms: string[]; caption: string; schedule_mode: "now" | "scheduled" | "random_window"; scheduled_at?: string }) {
    const asset = mediaRepository.findById(payload.media_asset_id);
    if (!asset) throw new AppError("Mídia não encontrada para agendamento", 404, "MEDIA_NOT_FOUND");

    return payload.platforms.map((platform) => postsRepository.create({
      media_asset_id: asset.id,
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
    }));
  },

  async publishNow(id: string) {
    const post = postsRepository.findById(id);
    if (!post) throw new AppError("Post não encontrado", 404, "POST_NOT_FOUND");
    if (!post.platform) throw new AppError("Post sem plataforma definida", 400, "POST_PLATFORM_MISSING");

    const result = await platformsService.publish(post.platform, {
      post_id: post.id,
      media_asset_id: post.media_asset_id,
      product_name: post.product_name,
      caption: post.caption || "",
      media_url: post.thumbnail_url,
    });

    return postsRepository.update(id, {
      status: result.status,
      published_at: result.status === "published" ? nowIso() : post.published_at,
      external_post_id: result.external_post_id,
      external_url: result.external_url,
      error_message: result.status === "failed" ? result.message : undefined,
      retry_count: (post.retry_count || 0) + 1,
      last_sync_at: nowIso(),
    });
  },
};
