import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers.x-automedia-signature",
      "req.headers.x-hub-signature-256",
      "req.headers.x-shopee-signature",
      "req.headers.x-tt-signature",
      "req.headers.x-tiktok-signature",
      "res.headers.set-cookie",
      "*.access_token",
      "*.refresh_token",
      "*.client_secret",
      "*.secret",
      "*.token",
      "*.api_key",
      "*.webhook",
    ],
    censor: "[REDACTED]",
  },
});
