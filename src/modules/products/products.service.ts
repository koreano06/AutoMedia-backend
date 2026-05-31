import { jobsRepository } from "../jobs/jobs.repository.js";
import { productsRepository } from "./products.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { Product } from "../../shared/types/domain.js";
import { auditService } from "../audit/audit.service.js";

export const productsService = {
  list(order?: string, limit?: number, workspaceId?: string) {
    if (workspaceId) return productsRepository.filter({ workspace_id: workspaceId }, order, limit);
    return productsRepository.list(order, limit);
  },

  create(payload: Partial<Product>, actorId?: string, workspaceId?: string) {
    return productsRepository.create({
      ...payload,
      workspace_id: workspaceId,
      attributes: {
        ...(payload.attributes || {}),
        owner_user_id: actorId || "system",
      },
      name: payload.name || "Anúncio sem nome",
      status: payload.status || "analyzing",
      media_count: payload.media_count || 0,
      posts_published: payload.posts_published || 0,
      videos_generated: payload.videos_generated || 0,
    });
  },

  async update(id: string, payload: Partial<Product>, workspaceId?: string) {
    const product = await productsRepository.findById(id);
    if (!product) throw new AppError("Anúncio base não encontrado", 404, "AD_NOT_FOUND");
    if (workspaceId && product.workspace_id && product.workspace_id !== workspaceId) throw new AppError("Anúncio não pertence a este workspace", 403, "WORKSPACE_FORBIDDEN");
    return productsRepository.update(id, payload);
  },

  async delete(id: string, actorId?: string, workspaceId?: string) {
    const product = await productsRepository.findById(id);
    if (!product) throw new AppError("Anúncio base não encontrado", 404, "AD_NOT_FOUND");
    if (workspaceId && product.workspace_id && product.workspace_id !== workspaceId) throw new AppError("Anúncio não pertence a este workspace", 403, "WORKSPACE_FORBIDDEN");
    const deleted = await productsRepository.delete(id);
    await auditService.log({ actor_id: actorId, action: "product.delete", entity_type: "product", entity_id: id, before: product });
    return deleted;
  },

  async analyze(payload: { product_id?: string; source_url?: string; image_asset_id?: string }, actorId?: string, workspaceId?: string) {
    const product = payload.product_id ? await productsRepository.findById(payload.product_id) : null;
    if (payload.product_id && !product) throw new AppError("Anúncio base não encontrado para análise", 404, "AD_NOT_FOUND");
    if (workspaceId && product?.workspace_id && product.workspace_id !== workspaceId) throw new AppError("Anúncio não pertence a este workspace", 403, "WORKSPACE_FORBIDDEN");

    const targetProduct = product || await productsRepository.create({
      workspace_id: workspaceId,
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
      workspace_id: workspaceId,
      progress: 0,
    });

    return { product: targetProduct, job };
  },
};
