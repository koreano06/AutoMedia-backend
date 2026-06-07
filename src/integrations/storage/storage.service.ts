import { mkdir, readFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";

type UploadVideoInput = {
  localPath: string;
  key: string;
  contentType?: string;
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
  const key = input.key.replace(/^\/+/, "");
  const client = createS3Client();

  await client.send(new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    Body: file,
    ContentType: input.contentType || "video/mp4",
  }));

  return {
    url: publicS3Url(key),
    storage_key: key,
    provider: "s3",
  };
}

async function uploadToSupabase(input: UploadVideoInput) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new AppError("Supabase Storage não configurado para upload de vídeo", 409, "SUPABASE_STORAGE_NOT_CONFIGURED");
  }

  const file = await readFile(input.localPath);
  const response = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${env.SUPABASE_STORAGE_BUCKET}/${input.key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": input.contentType || "video/mp4",
      "x-upsert": "true",
    },
    body: file,
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
  const relativeKey = input.key.replace(/^\/+/, "");
  const targetPath = path.join(process.cwd(), env.UPLOADS_DIR, relativeKey);

  await mkdir(path.dirname(targetPath), { recursive: true });
  await copyFile(input.localPath, targetPath);

  return {
    url: `${env.API_PUBLIC_URL.replace(/\/$/, "")}/${env.UPLOADS_DIR}/${relativeKey}`.replace(/([^:]\/)\/+/g, "$1"),
    storage_key: relativeKey,
    provider: "local",
  };
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
};
