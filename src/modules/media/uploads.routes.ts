import type { FastifyInstance } from "fastify";
import { created } from "../../shared/http/reply.js";
import { mediaRepository } from "./media.repository.js";

export async function registerUploadsRoutes(app: FastifyInstance) {
  app.post("/product-image", async (request, reply) => {
    const body = (request.body || {}) as {
      product_id?: string;
      product_name?: string;
      title?: string;
      url?: string;
      thumbnail_url?: string;
      mime_type?: string;
      file_size?: number;
    };

    const asset = mediaRepository.create({
      product_id: body.product_id,
      product_name: body.product_name,
      type: "image",
      title: body.title || "Imagem de produto enviada",
      status: "collected",
      source: "upload",
      url: body.url || "/uploads/product-image-placeholder.png",
      thumbnail_url: body.thumbnail_url || body.url || "/uploads/product-image-placeholder.png",
      storage_key: `product-images/${Date.now()}.png`,
      mime_type: body.mime_type || "image/png",
      file_size: body.file_size,
    });

    return created(reply, { asset });
  });
}
