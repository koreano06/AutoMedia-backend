import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "./AppError.js";
import { securityService } from "../../modules/security/security.service.js";

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

  return reply.status(error.statusCode || 500).send({
    error: {
      code: error.code || "INTERNAL_ERROR",
      message: error.message || "Erro interno",
    },
  });
}
