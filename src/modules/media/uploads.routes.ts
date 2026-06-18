import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { created } from "../../shared/http/reply.js";
import { mediaRepository } from "./media.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { storageService } from "../../integrations/storage/storage.service.js";

type ImageMimeType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

const uploadSchema = z.object({
  product_id: z.string().optional(),
  product_name: z.string().optional(),
  title: z.string().max(160).optional(),
  url: z.string().url().or(z.string().startsWith("data:image/")).optional(),
  thumbnail_url: z.string().url().or(z.string().startsWith("data:image/")).optional(),
  caption: z.string().optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  quality_score: z.coerce.number().min(0).max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]).default("image/png"),
  file_size: z.coerce.number().int().positive().max(8 * 1024 * 1024).optional(),
});

const extensionByMime: Record<ImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function decodeDataImage(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);
  if (!match) {
    throw new AppError("Formato de imagem inválido para upload", 400, "INVALID_IMAGE_DATA_URL");
  }

  return {
    mimeType: match[1] as ImageMimeType,
    buffer: Buffer.from(match[2], "base64"),
  };
}

export async function registerUploadsRoutes(app: FastifyInstance) {
  app.post("/product-image", async (request, reply) => {
    const body = uploadSchema.parse(request.body || {});

    if (!body.url && !body.thumbnail_url) {
      throw new AppError("Envie uma URL de imagem válida", 400, "UPLOAD_URL_REQUIRED");
    }

    let storedUrl = body.url || "/uploads/product-image-placeholder.png";
    let storageKey = `product-images/${Date.now()}.${extensionByMime[body.mime_type] || "png"}`;
    let fileSize = body.file_size;
    let mimeType = body.mime_type || "image/png";

    if (body.url?.startsWith("data:image/")) {
      const decoded = decodeDataImage(body.url);
      mimeType = decoded.mimeType;
      fileSize = decoded.buffer.byteLength;
      storageKey = `product-images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionByMime[mimeType] || "png"}`;
      const upload = await storageService.uploadBuffer({
        buffer: decoded.buffer,
        key: storageKey,
        contentType: mimeType,
      });

      storedUrl = upload.url;
      storageKey = upload.storage_key;
    }

    const asset = await mediaRepository.create({
      product_id: body.product_id,
      workspace_id: request.user?.workspace_id,
      product_name: body.product_name,
      type: "image",
      title: body.title || "Imagem de produto enviada",
      status: body.status || "pending_review",
      source: body.source || "Upload local",
      url: storedUrl,
      thumbnail_url: body.thumbnail_url?.startsWith("data:image/") ? storedUrl : body.thumbnail_url || storedUrl,
      storage_key: storageKey,
      mime_type: mimeType,
      file_size: fileSize,
      caption: body.caption,
      quality_score: body.quality_score,
      metadata: {
        ...(body.metadata || {}),
        storage_persisted: body.url?.startsWith("data:image/") || undefined,
      },
    });

    return created(reply, { asset });
  });
}
