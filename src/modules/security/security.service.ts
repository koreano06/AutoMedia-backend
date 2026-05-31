import { prisma } from "../../database/prisma.js";
import { env } from "../../config/env.js";
import { auditService } from "../audit/audit.service.js";

type SecurityEventInput = {
  action: string;
  actor_id?: string;
  entity_type?: string;
  entity_id?: string;
  ip?: string;
  user_agent?: string;
  username?: string;
  metadata?: Record<string, unknown>;
};

function since(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

export const securityService = {
  async record(input: SecurityEventInput) {
    await auditService.log({
      actor_id: input.actor_id,
      action: input.action,
      entity_type: input.entity_type || "security",
      entity_id: input.entity_id,
      metadata: {
        ip: input.ip,
        user_agent: input.user_agent,
        username: input.username,
        ...(input.metadata || {}),
      },
    });
  },

  async assertLoginAllowed(username: string, ip?: string) {
    const normalizedUsername = username.trim().toLowerCase();
    const recentFailures = await prisma.auditLog.count({
      where: {
        action: "auth.login_failed",
        createdAt: { gte: since(env.LOGIN_WINDOW_MINUTES) },
        OR: [
          { metadata: { path: ["username"], equals: normalizedUsername } },
          ...(ip ? [{ metadata: { path: ["ip"], equals: ip } }] : []),
        ],
      },
    });

    if (recentFailures >= env.LOGIN_FAILURE_LIMIT) {
      return {
        allowed: false,
        retry_after_seconds: env.LOGIN_LOCK_MINUTES * 60,
      };
    }

    return { allowed: true, retry_after_seconds: 0 };
  },

  async recordLoginFailure(username: string, ip?: string, userAgent?: string, reason = "invalid_credentials") {
    await this.record({
      action: "auth.login_failed",
      username: username.trim().toLowerCase(),
      ip,
      user_agent: userAgent,
      metadata: { reason },
    });
  },
};
