import type { FastifyInstance } from "fastify";
import { created } from "../../shared/http/reply.js";
import { mediaRepository } from "./media.repository.js";

export async function registerUploadsRoutes(app: FastifyInstance) {
  app.post("/product-image", async (_request, reply) => {
    const asset = mediaRepository.create({
      type: "image",
      title: "Imagem de produto enviada",
      status: "collected",
      source: "upload",
      url: "/uploads/product-image-placeholder.png",
      thumbnail_url: "/uploads/product-image-placeholder.png",
      storage_key: `product-images/${Date.now()}.png`,
      mime_type: "image/png",
    });

    return created(reply, { asset });
  });
}
