import { commentsRepository } from "../comments/comments.repository.js";
import { productsRepository } from "../products/products.repository.js";

function asNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function margin(product: { price?: number | string; cost_price?: number | string; margin_percent?: number }) {
  if (product.margin_percent) return product.margin_percent;
  const price = asNumber(product.price);
  const cost = asNumber(product.cost_price);
  if (!price || !cost) return 0;
  return Math.round(((price - cost) / price) * 100);
}

export const commercialService = {
  summary() {
    const products = productsRepository.list("-created_at", 1000);
    const comments = commentsRepository.list("-detected_at", 1000);
    const lowStock = products.filter((product) => asNumber(product.stock_quantity) <= asNumber(product.min_stock || 5));
    const purchaseLeads = comments.filter((comment) => comment.is_purchase_intent);
    const averageMargin = products.length ? Math.round(products.reduce((sum, product) => sum + margin(product), 0) / products.length) : 0;
    const potentialRevenue = products.reduce((sum, product) => sum + asNumber(product.price) * asNumber(product.stock_quantity), 0);

    return {
      products_count: products.length,
      low_stock_count: lowStock.length,
      purchase_leads_count: purchaseLeads.length,
      average_margin: averageMargin,
      potential_revenue: potentialRevenue,
    };
  },

  leads() {
    return commentsRepository.filter({ is_purchase_intent: true }, "-detected_at", 1000);
  },
};
