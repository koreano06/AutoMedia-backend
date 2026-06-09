import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";

type UploadVideoInput = {
  localPath: string;
  key: string;
  contentType?: string;
};

type UploadBufferInput = {
  buffer: Buffer;
  key: string;
  contentType?: string;
};

type CacheRemoteMediaInput = {
  url: string;
  keyPrefix: string;
  fallbackName?: string;
};

const extensionByMime: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

function publicSupabaseUrl(key: string) {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${env.SUPABASE_URL}/storage/v1/object/public/${env.SUPABASE_STORAGE_BUCKET}/${encodedKey}`;
}

function publicS3Url(key: string) {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const baseUrl = (env.S3_PUBLIC_URL || env.S3_ENDPOINT || "").replace(/\/$/, "");
  return `${baseUrl}/${env.S3_BUCKET}/${encodedKey}`;
}

function createS3Client() {
  if (!env.S3_ENDPOINT || !env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new AppError("S3/MinIO não configurado para upload de vídeo", 409, "S3_STORAGE_NOT_CONFIGURED");
  }

  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
}

async function uploadToS3(input: UploadVideoInput) {
  const file = await readFile(input.localPath);
  return uploadBufferToS3({ buffer: file, key: input.key, contentType: input.contentType || "video/mp4" });
}

async function uploadBufferToS3(input: UploadBufferInput) {
  const key = input.key.replace(/^\/+/, "");
  const client = createS3Client();

  await client.send(new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    Body: input.buffer,
    ContentType: input.contentType || "video/mp4",
  }));

  return {
    url: publicS3Url(key),
    storage_key: key,
    provider: "s3",
  };
}

async function uploadToSupabase(input: UploadVideoInput) {
  const file = await readFile(input.localPath);
  return uploadBufferToSupabase({ buffer: file, key: input.key, contentType: input.contentType || "video/mp4" });
}

async function uploadBufferToSupabase(input: UploadBufferInput) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new AppError("Supabase Storage não configurado para upload de vídeo", 409, "SUPABASE_STORAGE_NOT_CONFIGURED");
  }

  const response = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${env.SUPABASE_STORAGE_BUCKET}/${input.key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": input.contentType || "video/mp4",
      "x-upsert": "true",
    },
    body: input.buffer as unknown as BodyInit,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new AppError(message || "Falha ao enviar vídeo para Supabase Storage", response.status, "SUPABASE_UPLOAD_ERROR");
  }

  return {
    url: publicSupabaseUrl(input.key),
    storage_key: input.key,
    provider: "supabase",
  };
}

async function uploadToLocal(input: UploadVideoInput) {
  const file = await readFile(input.localPath);
  return uploadBufferToLocal({ buffer: file, key: input.key, contentType: input.contentType || "video/mp4" });
}

async function uploadBufferToLocal(input: UploadBufferInput) {
  const relativeKey = input.key.replace(/^\/+/, "");
  const targetPath = path.join(process.cwd(), env.UPLOADS_DIR, relativeKey);

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, input.buffer);

  return {
    url: `${env.API_PUBLIC_URL.replace(/\/$/, "")}/${env.UPLOADS_DIR}/${relativeKey}`.replace(/([^:]\/)\/+/g, "$1"),
    storage_key: relativeKey,
    provider: "local",
  };
}

function getExtension(contentType?: string, fallbackName?: string) {
  const normalized = String(contentType || "").split(";")[0].trim().toLowerCase();
  if (extensionByMime[normalized]) return extensionByMime[normalized];

  const fallbackExtension = String(fallbackName || "").split("?")[0].split(".").pop();
  if (fallbackExtension && /^[a-z0-9]{2,5}$/i.test(fallbackExtension)) return fallbackExtension.toLowerCase();

  return "bin";
}

async function uploadBuffer(input: UploadBufferInput) {
  if (env.STORAGE_DRIVER === "s3") {
    return uploadBufferToS3(input);
  }

  if (env.STORAGE_DRIVER === "supabase") {
    return uploadBufferToSupabase(input);
  }

  return uploadBufferToLocal(input);
}

export const storageService = {
  async uploadVideo(input: UploadVideoInput) {
    if (env.STORAGE_DRIVER === "s3") {
      return uploadToS3(input);
    }

    if (env.STORAGE_DRIVER === "supabase") {
      return uploadToSupabase(input);
    }

    return uploadToLocal(input);
  },

  async uploadBuffer(input: UploadBufferInput) {
    return uploadBuffer(input);
  },

  async cacheRemoteMedia(input: CacheRemoteMediaInput) {
    const response = await fetch(input.url, {
      headers: {
        "User-Agent": "AutoMediaBot/1.0 (+https://automedia.local)",
        Accept: "image/*,video/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new AppError(`Fonte externa retornou HTTP ${response.status}`, 502, "REMOTE_MEDIA_FETCH_FAILED");
    }

    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
    if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
      throw new AppError(`Tipo de mídia externa não suportado: ${contentType}`, 415, "REMOTE_MEDIA_UNSUPPORTED_TYPE");
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const extension = getExtension(contentType, input.fallbackName || input.url);
    const safePrefix = input.keyPrefix.replace(/^\/+|\/+$/g, "");
    const key = `${safePrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    const upload = await uploadBuffer({ buffer, key, contentType });

    return {
      ...upload,
      cached: true,
      content_type: contentType,
      size: buffer.byteLength,
      original_url: input.url,
    };
  },
};
