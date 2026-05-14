import type { FastifyReply } from "fastify";

export function created<T>(reply: FastifyReply, payload: T) {
  return reply.status(201).send(payload);
}

export function accepted<T>(reply: FastifyReply, payload: T) {
  return reply.status(202).send(payload);
}
