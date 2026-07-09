import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";
import { authRepository } from "./auth.repository.js";
import { auditService } from "../audit/audit.service.js";
import { securityService } from "../security/security.service.js";
import { requireWorkspaceId } from "../../shared/utils/workspace.js";

type AuthJwtPayload = {
  sub: string;
  role: string;
  workspace_id?: string;
};

function resolveWorkspaceId(workspaceId?: string | null) {
  return requireWorkspaceId(workspaceId);
}

function publicUser(user: { id: string; name: string; username: string; role: string; workspaceId?: string | null; storeName?: string | null; createdAt?: Date }) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    workspace_id: resolveWorkspaceId(user.workspaceId),
    store_name: user.storeName || undefined,
    created_at: user.createdAt?.toISOString(),
  };
}

function signToken(payload: AuthJwtPayload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"],
    issuer: "automedia-api",
    audience: "automedia-web",
  });
}

function refreshTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function issueRefreshToken(userId: string) {
  const token = randomBytes(48).toString("base64url");
  await authRepository.createRefreshToken({
    userId,
    tokenHash: refreshTokenHash(token),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
  });
  return token;
}

export const authService = {
  async login(payload: { email?: string; username?: string; password: string }, context: { ip?: string; user_agent?: string } = {}) {
    const username = (payload.username || payload.email || "").trim().toLowerCase();
    if (!username) throw new AppError("Usuário ou senha inválidos", 401, "INVALID_CREDENTIALS");

    const loginGate = await securityService.assertLoginAllowed(username, context.ip);
    if (!loginGate.allowed) {
      await securityService.record({
        action: "auth.login_blocked",
        username,
        ip: context.ip,
        user_agent: context.user_agent,
        metadata: { retry_after_seconds: loginGate.retry_after_seconds },
      });
      throw new AppError("Muitas tentativas de login. Aguarde alguns minutos e tente novamente.", 429, "LOGIN_TEMPORARILY_LOCKED");
    }

    const user = await authRepository.findByUsername(username);
    const passwordMatches = user ? await bcrypt.compare(payload.password, user.passwordHash) : false;

    if (!user || !passwordMatches) {
      await securityService.recordLoginFailure(username, context.ip, context.user_agent);
      throw new AppError("Usuário ou senha inválidos", 401, "INVALID_CREDENTIALS");
    }

    const token = signToken({ sub: user.id, role: user.role, workspace_id: resolveWorkspaceId(user.workspaceId) });
    const refreshToken = await issueRefreshToken(user.id);
    await auditService.log({
      actor_id: user.id,
      action: "auth.login",
      entity_type: "user",
      entity_id: user.id,
      metadata: { username: user.username, ip: context.ip, user_agent: context.user_agent },
    });

    return { user: publicUser(user), token, refresh_token: refreshToken, expires_in: 900 };
  },

  async me(userId: string) {
    const user = await authRepository.findById(userId);
    if (!user) throw new AppError("Usuário não encontrado", 404, "USER_NOT_FOUND");
    return publicUser(user);
  },

  async refresh(refreshToken: string) {
    const record = await authRepository.findRefreshToken(refreshTokenHash(refreshToken));
    if (!record) {
      await securityService.record({ action: "auth.refresh_invalid", metadata: { reason: "missing_or_expired" } });
      throw new AppError("Refresh token inválido ou expirado", 401, "INVALID_REFRESH_TOKEN");
    }

    await authRepository.revokeRefreshToken(refreshTokenHash(refreshToken));
    const token = signToken({ sub: record.user.id, role: record.user.role, workspace_id: resolveWorkspaceId(record.user.workspaceId) });
    const nextRefreshToken = await issueRefreshToken(record.user.id);

    await auditService.log({
      actor_id: record.user.id,
      action: "auth.refresh",
      entity_type: "user",
      entity_id: record.user.id,
    });

    return { user: publicUser(record.user), token, refresh_token: nextRefreshToken, expires_in: 900 };
  },

  async logout(refreshToken?: string) {
    if (refreshToken) {
      await authRepository.revokeRefreshToken(refreshTokenHash(refreshToken));
    }

    return { success: true };
  },
};
