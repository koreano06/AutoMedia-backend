import { env } from "./env.js";

export const corsOptions = {
  origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
  credentials: true,
};
