import { env } from "./env.js";

const developmentOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:4175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:4175",
];

function uniqueOrigins(origins: string[]) {
  return [...new Set(origins.map((origin) => origin.trim()).filter(Boolean))];
}

export const corsOptions = {
  origin: env.CORS_ORIGIN === "*"
    ? true
    : uniqueOrigins([
      ...env.CORS_ORIGIN.split(","),
      ...developmentOrigins,
    ]),
  credentials: true,
};
