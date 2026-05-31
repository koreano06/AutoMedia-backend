import { mediaRepository } from "../media/media.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { nowIso } from "../../shared/utils/dates.js";
import { auditService } from "../audit/audit.service.js";

export const approvalsService = {
  async approve(payload: { media_asset_id: string; platforms: string[]; caption: string }, actorId?: string) {
    const asset = await mediaRepository.findById(payload.media_asset_id);
    if (!asset) throw new AppError("Mídia não encontrada para aprovação", 404, "MEDIA_NOT_FOUND");

    const updated = await mediaRepository.update(asset.id, {
      status: "approved",
      platforms: payload.platforms,
      caption: payload.caption || asset.caption,
      reviewed_by: actorId || "system",
      reviewed_at: nowIso(),
    });
    await auditService.log({ actor_id: actorId, action: "media.approve", entity_type: "media_asset", entity_id: asset.id, before: asset, after: updated });
    return updated;
  },

  async reject(payload: { media_asset_id: string; rejection_reason?: string; review_notes?: string }, actorId?: string) {
    const asset = await mediaRepository.findById(payload.media_asset_id);
    if (!asset) throw new AppError("Mídia não encontrada para rejeição", 404, "MEDIA_NOT_FOUND");

    const updated = await mediaRepository.update(asset.id, {
      status: "rejected",
      rejection_reason: payload.rejection_reason,
      review_notes: payload.review_notes,
      reviewed_by: actorId || "system",
      reviewed_at: nowIso(),
    });
    await auditService.log({ actor_id: actorId, action: "media.reject", entity_type: "media_asset", entity_id: asset.id, before: asset, after: updated });
    return updated;
  },
};
