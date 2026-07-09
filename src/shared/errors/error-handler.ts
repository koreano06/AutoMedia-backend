import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "./AppError.js";
import { env } from "../../config/env.js";
import { securityService } from "../../modules/security/security.service.js";
import { logger } from "../utils/logger.js";

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof AppError) {
    if ([401, 403, 429].includes(error.statusCode)) {
      void securityService.record({
        action: `security.http_${error.statusCode}`,
        actor_id: request.user?.id,
        ip: request.ip,
        user_agent: request.headers["user-agent"],
        metadata: { code: error.code, path: request.url },
      });
    }

    return reply.status(error.statusCode).send({ error: { code: error.code, message: error.message } });
  }

  void securityService.record({
    action: "security.unhandled_error",
    actor_id: request.user?.id,
    ip: request.ip,
    user_agent: request.headers["user-agent"],
    metadata: { code: error.code, path: request.url, message: error.message },
  });
  logger.error({
    err: error,
    path: request.url,
    method: request.method,
    actor_id: request.user?.id,
  }, "unhandled_request_error");

  return reply.status(error.statusCode || 500).send({
    error: {
      code: error.code || "INTERNAL_ERROR",
      message: env.NODE_ENV === "production" ? "Erro interno" : (error.message || "Erro interno"),
    },
  });
}
