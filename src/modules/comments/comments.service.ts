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
  list(order = "-detected_at", limit?: number) {
    return commentsRepository.list(order, limit);
  },

  create(payload: Partial<Comment>) {
    return commentsRepository.create({
      detected_at: nowIso(),
      is_purchase_intent: payload.is_purchase_intent ?? detectPurchaseIntent(payload.content),
      auto_replied: false,
      ...payload,
    });
  },

  update(id: string, payload: Partial<Comment>) {
    return commentsRepository.update(id, payload);
  },

  async autoReply(payload: { comment_id: string; product_id?: string; reply_template: string }) {
    const comment = await commentsRepository.findById(payload.comment_id);
    if (!comment) throw new AppError("Comentário não encontrado", 404, "COMMENT_NOT_FOUND");
    const product = payload.product_id ? await productsRepository.findById(payload.product_id) : null;
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
