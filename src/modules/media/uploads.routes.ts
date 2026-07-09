import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { created } from "../../shared/http/reply.js";
import { mediaRepository } from "./media.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { storageService } from "../../integrations/storage/storage.service.js";
import { requireWorkspaceId } from "../../shared/utils/workspace.js";

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

function assertAllowedRemoteImageUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new AppError("A URL remota da imagem precisa usar HTTPS", 422, "UPLOAD_URL_HTTPS_REQUIRED");
  }

  if (!/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url.pathname)) {
    throw new AppError("A URL remota precisa apontar para uma imagem permitida", 422, "UPLOAD_URL_INVALID_EXTENSION");
  }
}

function assertSupportedImageBuffer(buffer: Buffer, mimeType: ImageMimeType) {
  const signatures: Record<ImageMimeType, (value: Buffer) => boolean> = {
    "image/jpeg": (value) => value.length > 3 && value[0] === 0xff && value[1] === 0xd8 && value[2] === 0xff,
    "image/png": (value) => value.length > 8 && value.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/webp": (value) => value.length > 12 && value.subarray(0, 4).toString("ascii") === "RIFF" && value.subarray(8, 12).toString("ascii") === "WEBP",
    "image/gif": (value) => value.length > 6 && ["GIF87a", "GIF89a"].includes(value.subarray(0, 6).toString("ascii")),
  };

  if (!signatures[mimeType](buffer)) {
    throw new AppError("O arquivo enviado nao corresponde ao tipo de imagem informado", 415, "UPLOAD_IMAGE_SIGNATURE_INVALID");
  }
}

export async function registerUploadsRoutes(app: FastifyInstance) {
  app.post("/product-image", { config: { rateLimit: { max: 12, timeWindow: "1 minute" } } }, async (request, reply) => {
    const workspaceId = requireWorkspaceId(request.user?.workspace_id);
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
      assertSupportedImageBuffer(decoded.buffer, mimeType);
      if (fileSize > 8 * 1024 * 1024) {
        throw new AppError("Imagem enviada excede o limite maximo permitido", 413, "UPLOAD_FILE_TOO_LARGE");
      }
      storageKey = `product-images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionByMime[mimeType] || "png"}`;
      const upload = await storageService.uploadBuffer({
        buffer: decoded.buffer,
        key: storageKey,
        contentType: mimeType,
      });

      storedUrl = upload.url;
      storageKey = upload.storage_key;
    } else if (body.url) {
      assertAllowedRemoteImageUrl(body.url);
    }

    const asset = await mediaRepository.create({
      product_id: body.product_id,
      workspace_id: workspaceId,
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
