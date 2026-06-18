import { jobsRepository } from "../jobs/jobs.repository.js";
import { mediaRepository } from "./media.repository.js";
import type { MediaAsset } from "../../shared/types/domain.js";
import { AppError } from "../../shared/errors/AppError.js";
import { auditService } from "../audit/audit.service.js";

export const mediaService = {
  list(query: { order?: string; limit?: number; type?: string; status?: string; product_id?: string; workspace_id?: string }) {
    const { order, limit, ...filter } = query;
    const activeFilter = Object.fromEntries(Object.entries(filter).filter(([, value]) => value !== undefined));
    return Object.keys(activeFilter).length
      ? mediaRepository.filter(activeFilter as Partial<MediaAsset>, order, limit)
      : mediaRepository.list(order, limit);
  },

  async create(payload: Partial<MediaAsset>, workspaceId?: string, actorId?: string) {
    const asset = await mediaRepository.create({ status: payload.status || "collected", type: payload.type || "image", workspace_id: workspaceId, ...payload });
    await auditService.log({
      actor_id: actorId,
      action: "media.create",
      entity_type: "media_asset",
      entity_id: asset.id,
      after: asset,
    });
    return asset;
  },

  async update(id: string, payload: Partial<MediaAsset>, workspaceId?: string, actorId?: string) {
    const asset = await mediaRepository.findById(id);
    if (!asset) throw new AppError("Mídia não encontrada", 404, "MEDIA_NOT_FOUND");
    if (workspaceId && asset.workspace_id && asset.workspace_id !== workspaceId) throw new AppError("Mídia não pertence a este workspace", 403, "WORKSPACE_FORBIDDEN");
    const updated = await mediaRepository.update(id, payload);
    await auditService.log({
      actor_id: actorId,
      action: payload.status && payload.status !== asset.status ? `media.status.${payload.status}` : "media.update",
      entity_type: "media_asset",
      entity_id: id,
      before: asset,
      after: updated,
    });
    return updated;
  },

  async collect(payload: { product_id: string; query?: string; sources: string[] }, workspaceId?: string) {
    const job = await jobsRepository.create({
      type: "media_collection",
      status: "queued",
      title: `Coleta de mídia para anúncio - ${payload.query || payload.product_id}`,
      product_id: payload.product_id,
      workspace_id: workspaceId,
      progress: 0,
    });
    return { job };
  },
};
