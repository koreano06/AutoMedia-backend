import { jobsRepository } from "../jobs/jobs.repository.js";
import { mediaRepository } from "./media.repository.js";
import type { MediaAsset } from "../../shared/types/domain.js";

export const mediaService = {
  list(query: { order?: string; limit?: number; type?: string; status?: string; product_id?: string }) {
    const { order, limit, ...filter } = query;
    const activeFilter = Object.fromEntries(Object.entries(filter).filter(([, value]) => value !== undefined));
    return Object.keys(activeFilter).length
      ? mediaRepository.filter(activeFilter as Partial<MediaAsset>, order, limit)
      : mediaRepository.list(order, limit);
  },

  create(payload: Partial<MediaAsset>) {
    return mediaRepository.create({ status: payload.status || "collected", type: payload.type || "image", ...payload });
  },

  update(id: string, payload: Partial<MediaAsset>) {
    return mediaRepository.update(id, payload);
  },

  async collect(payload: { product_id: string; query?: string; sources: string[] }) {
    const job = await jobsRepository.create({
      type: "media_collection",
      status: "queued",
      title: `Coleta de mídia para anúncio - ${payload.query || payload.product_id}`,
      product_id: payload.product_id,
      progress: 0,
    });
    return { job };
  },
};
