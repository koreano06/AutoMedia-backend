import { mkdir, readFile, copyFile } from "node:fs/promises";
import path from "node:path";
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
    if (env.STORAGE_DRIVER === "supabase") {
      return uploadToSupabase(input);
    }

    return uploadToLocal(input);
  },
};
