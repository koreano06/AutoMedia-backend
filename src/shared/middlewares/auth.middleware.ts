import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { AppError } from "../errors/AppError.js";
import { securityService } from "../../modules/security/security.service.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: string;
      role: string;
      workspace_id?: string;
    };
  }
}

type TokenPayload = {
  sub?: string;
  role?: string;
  workspace_id?: string;
};

const publicRoutes = [
  /^\/health$/,
  /^\/api\/health$/,
  /^\/api\/meta\/routes$/,
  /^\/api\/auth\/login$/,
  /^\/api\/auth\/refresh$/,
  /^\/api\/platform-callback$/,
];

function isPublicRoute(request: FastifyRequest) {
  if (request.method === "OPTIONS") return true;
  const path = request.url.split("?")[0];
  return publicRoutes.some((route) => route.test(path));
}

export function requireRole(roles: string[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.user) {
      throw new AppError("Autenticação obrigatória", 401, "AUTH_REQUIRED");
    }

    if (!roles.includes(request.user.role)) {
      throw new AppError("Permissão insuficiente", 403, "FORBIDDEN");
    }
  };
}

export async function authMiddleware(request: FastifyRequest, _reply: FastifyReply) {
  if (isPublicRoute(request)) return;

  const authorization = request.headers.authorization;
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;

  if (!token) {
    throw new AppError("Autenticação obrigatória", 401, "AUTH_REQUIRED");
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: "automedia-api",
      audience: "automedia-web",
    }) as TokenPayload;

    if (!payload.sub || !payload.role) {
      await securityService.record({ action: "auth.invalid_token_payload", ip: request.ip, user_agent: request.headers["user-agent"] });
      throw new AppError("Token inválido", 401, "INVALID_TOKEN");
    }

    request.user = {
      id: payload.sub,
      role: payload.role,
      workspace_id: payload.workspace_id,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    await securityService.record({ action: "auth.invalid_token", ip: request.ip, user_agent: request.headers["user-agent"], metadata: { path: request.url } });
    throw new AppError("Token inválido ou expirado", 401, "INVALID_TOKEN");
  }
}
