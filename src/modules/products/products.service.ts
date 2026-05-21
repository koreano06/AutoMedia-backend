import { jobsRepository } from "../jobs/jobs.repository.js";
import { productsRepository } from "./products.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { Product } from "../../shared/types/domain.js";

export const productsService = {
  list(order?: string, limit?: number) {
    return productsRepository.list(order, limit);
  },

  create(payload: Partial<Product>) {
    return productsRepository.create({
      ...payload,
      name: payload.name || "Anúncio sem nome",
      status: payload.status || "analyzing",
      media_count: payload.media_count || 0,
      posts_published: payload.posts_published || 0,
      videos_generated: payload.videos_generated || 0,
    });
  },

  update(id: string, payload: Partial<Product>) {
    return productsRepository.update(id, payload);
  },

  delete(id: string) {
    return productsRepository.delete(id);
  },

  async analyze(payload: { product_id?: string; source_url?: string; image_asset_id?: string }) {
    const product = payload.product_id ? await productsRepository.findById(payload.product_id) : null;
    if (payload.product_id && !product) throw new AppError("Anúncio base não encontrado para análise", 404, "AD_NOT_FOUND");

    const targetProduct = product || await productsRepository.create({
      name: "Anúncio em análise",
      source_url: payload.source_url,
      input_source: payload.source_url ? "product_url" : "image_upload",
      status: "analyzing",
      media_count: 0,
      posts_published: 0,
      videos_generated: 0,
    });

    const job = await jobsRepository.create({
      type: "product_analysis",
      status: "queued",
      title: `Análise de anúncio base - ${targetProduct.name}`,
      product_id: targetProduct.id,
      progress: 0,
    });

    return { product: targetProduct, job };
  },
};
