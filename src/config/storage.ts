import { env } from "./env.js";

export const storageConfig = {
  driver: env.STORAGE_DRIVER,
  uploadsDir: env.UPLOADS_DIR,
};
