import { productsRepository } from "../products/products.repository.js";
import { commentsRepository } from "./comments.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { nowIso } from "../../shared/utils/dates.js";
import type { Comment } from "../../shared/types/domain.js";

const purchaseKeywords = ["eu quero", "quanto custa", "comprar", "link", "preço", "onde compro"];

function detectPurchaseIntent(content = "") {
  const normalized = content.toLowerCase();
  return purchaseKeywords.some((keyword) => normalized.includes(keyword));
}

export const commentsService = {
  list(order = "-detected_at", limit?: number, workspaceId?: string) {
    if (workspaceId) return commentsRepository.filter({ workspace_id: workspaceId }, order, limit);
    return commentsRepository.list(order, limit);
  },

  create(payload: Partial<Comment>, workspaceId?: string) {
    return commentsRepository.create({
      workspace_id: workspaceId,
      detected_at: nowIso(),
      is_purchase_intent: payload.is_purchase_intent ?? detectPurchaseIntent(payload.content),
      auto_replied: false,
      ...payload,
    });
  },

  async update(id: string, payload: Partial<Comment>, workspaceId?: string) {
    const comment = await commentsRepository.findById(id);
    if (!comment) throw new AppError("Comentário não encontrado", 404, "COMMENT_NOT_FOUND");
    if (workspaceId && comment.workspace_id && comment.workspace_id !== workspaceId) throw new AppError("Comentário não pertence a este workspace", 403, "WORKSPACE_FORBIDDEN");
    return commentsRepository.update(id, payload);
  },

  async delete(id: string, workspaceId?: string) {
    const comment = await commentsRepository.findById(id);
    if (!comment) throw new AppError("Comentário não encontrado", 404, "COMMENT_NOT_FOUND");
    if (workspaceId && comment.workspace_id && comment.workspace_id !== workspaceId) throw new AppError("Comentário não pertence a este workspace", 403, "WORKSPACE_FORBIDDEN");
    return commentsRepository.delete(id);
  },

  async autoReply(payload: { comment_id: string; product_id?: string; reply_template: string }, workspaceId?: string) {
    const comment = await commentsRepository.findById(payload.comment_id);
    if (!comment) throw new AppError("Comentário não encontrado", 404, "COMMENT_NOT_FOUND");
    if (workspaceId && comment.workspace_id && comment.workspace_id !== workspaceId) throw new AppError("Comentário não pertence a este workspace", 403, "WORKSPACE_FORBIDDEN");
    const product = payload.product_id ? await productsRepository.findById(payload.product_id) : null;
    if (workspaceId && product?.workspace_id && product.workspace_id !== workspaceId) throw new AppError("Produto não pertence a este workspace", 403, "WORKSPACE_FORBIDDEN");
    const productUrl = product?.affiliate_url || product?.product_url || product?.source_url || "link indisponível";
    const reply = payload.reply_template.replace("{{product_url}}", productUrl);

    return commentsRepository.update(comment.id, {
      auto_replied: true,
      reply_content: reply,
      replied_at: nowIso(),
      is_purchase_intent: comment.is_purchase_intent ?? detectPurchaseIntent(comment.content),
    });
  },
};
