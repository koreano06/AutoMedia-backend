import type { FastifyReply, FastifyRequest } from "fastify";

export async function authMiddleware(_request: FastifyRequest, _reply: FastifyReply) {
  // TODO: validar JWT/cookie quando auth real entrar.
}
