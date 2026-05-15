import type { FastifyInstance } from "fastify";

const routeGroups = {
  health: ["GET /api/health"],
  products: ["GET /api/products", "POST /api/products", "POST /api/products/analyze", "PATCH /api/products/:id", "DELETE /api/products/:id"],
  media: ["GET /api/media-assets", "POST /api/media-assets", "PATCH /api/media-assets/:id", "POST /api/media/collect"],
  uploads: ["POST /api/uploads/product-image"],
  videos: ["POST /api/videos/generate"],
  posts: ["GET /api/posts", "POST /api/posts", "POST /api/posts/schedule", "POST /api/posts/:id/publish-now", "PATCH /api/posts/:id", "DELETE /api/posts/:id"],
  comments: ["GET /api/comments", "POST /api/comments", "POST /api/comments/auto-reply", "PATCH /api/comments/:id"],
  platforms: ["GET /api/platforms/accounts", "POST /api/platforms/:platform/connect", "POST /api/platforms/:platform/disconnect"],
  settings: ["GET /api/settings/automation", "PUT /api/settings/automation"],
  ai: ["POST /api/ai/generate-text"],
};

export async function registerMetaRoutes(app: FastifyInstance) {
  app.get("/routes", async () => ({
    service: "automedia-api",
    version: "2026-05-15-aligned",
    routeGroups,
  }));
}
