import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../config/env.js";
import { securityService } from "../../modules/security/security.service.js";
import { AppError } from "../errors/AppError.js";

type PlatformWebhook = "automedia" | "meta" | "tiktok" | "shopee" | "mercadolivre";

function digest(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function headerValue(header: string | string[] | undefined) {
  return Array.isArray(header) ? header[0] : header;
}

function rawBody(request: FastifyRequest) {
  return typeof request.body === "string" ? request.body : JSON.stringify(request.body || {});
}

function signatureConfig(platform: PlatformWebhook, request: FastifyRequest) {
  const body = rawBody(request);

  if (platform === "meta") {
    const signature = headerValue(request.headers["x-hub-signature-256"])?.replace("sha256=", "");
    return { signature, expected: env.META_CLIENT_SECRET ? digest(body, env.META_CLIENT_SECRET) : undefined, configured: Boolean(env.META_CLIENT_SECRET) };
  }

  if (platform === "shopee") {
    const signature = headerValue(request.headers["authorization"]) || headerValue(request.headers["x-shopee-signature"]);
    return { signature, expected: env.SHOPEE_PARTNER_KEY ? digest(body, env.SHOPEE_PARTNER_KEY) : undefined, configured: Boolean(env.SHOPEE_PARTNER_KEY) };
  }

  if (platform === "tiktok") {
    const signature = headerValue(request.headers["x-tt-signature"]) || headerValue(request.headers["x-tiktok-signature"]);
    return { signature, expected: env.TIKTOK_CLIENT_SECRET ? digest(body, env.TIKTOK_CLIENT_SECRET) : undefined, configured: Boolean(env.TIKTOK_CLIENT_SECRET) };
  }

  if (platform === "mercadolivre") {
    const signature = headerValue(request.headers["x-ml-signature"]) || headerValue(request.headers["x-mercadolivre-signature"]);
    return { signature, expected: env.MERCADOLIVRE_CLIENT_SECRET ? digest(body, env.MERCADOLIVRE_CLIENT_SECRET) : undefined, configured: Boolean(env.MERCADOLIVRE_CLIENT_SECRET) };
  }

  const signature = headerValue(request.headers["x-automedia-signature"]);
  return { signature, expected: env.WEBHOOK_SECRET ? digest(body, env.WEBHOOK_SECRET) : undefined, configured: Boolean(env.WEBHOOK_SECRET) };
}

export function verifyPlatformWebhookSignature(platform: PlatformWebhook = "automedia") {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const { signature, expected, configured } = signatureConfig(platform, request);

    if (!configured || !expected) {
      await securityService.record({ action: "webhook.secret_missing", ip: request.ip, user_agent: request.headers["user-agent"], metadata: { platform, path: request.url } });
      throw new AppError("Segredo de webhook não configurado", 500, "WEBHOOK_SECRET_MISSING");
    }

    if (!signature) {
      await securityService.record({ action: "webhook.signature_missing", ip: request.ip, user_agent: request.headers["user-agent"], metadata: { platform, path: request.url } });
      throw new AppError("Assinatura do webhook ausente", 401, "WEBHOOK_SIGNATURE_MISSING");
    }

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
      await securityService.record({ action: "webhook.signature_invalid", ip: request.ip, user_agent: request.headers["user-agent"], metadata: { platform, path: request.url } });
      throw new AppError("Assinatura do webhook inválida", 401, "WEBHOOK_SIGNATURE_INVALID");
    }
  };
}

export async function verifyWebhookSignature(request: FastifyRequest, reply: FastifyReply) {
  return verifyPlatformWebhookSignature("automedia")(request, reply);
}
