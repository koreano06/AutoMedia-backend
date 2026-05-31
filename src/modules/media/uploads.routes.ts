import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { created } from "../../shared/http/reply.js";
import { mediaRepository } from "./media.repository.js";
import { AppError } from "../../shared/errors/AppError.js";

const uploadSchema = z.object({
  product_id: z.string().optional(),
  product_name: z.string().optional(),
  title: z.string().max(160).optional(),
  url: z.string().url().or(z.string().startsWith("data:image/")).optional(),
  thumbnail_url: z.string().url().or(z.string().startsWith("data:image/")).optional(),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]).default("image/png"),
  file_size: z.coerce.number().int().positive().max(8 * 1024 * 1024).optional(),
});

export async function registerUploadsRoutes(app: FastifyInstance) {
  app.post("/product-image", async (request, reply) => {
    const body = uploadSchema.parse(request.body || {});

    if (!body.url && !body.thumbnail_url) {
      throw new AppError("Envie uma URL de imagem válida", 400, "UPLOAD_URL_REQUIRED");
    }

    const asset = mediaRepository.create({
      product_id: body.product_id,
      workspace_id: request.user?.workspace_id,
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
