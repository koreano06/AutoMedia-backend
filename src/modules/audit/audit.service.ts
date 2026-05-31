import { prisma } from "../../database/prisma.js";
import type { Prisma } from "@prisma/client";

type AuditInput = {
  actor_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
};

const sensitiveKeys = ["password", "passwordHash", "token", "access_token", "refresh_token", "accessToken", "refreshToken", "authorization", "secret", "client_secret", "partner_key"];

function maskEmail(value: string) {
  return value.replace(/^(.).+(@.+)$/, "$1***$2");
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      const normalizedKey = key.toLowerCase();
      if (sensitiveKeys.some((sensitiveKey) => normalizedKey.includes(sensitiveKey.toLowerCase()))) return [key, "[REDACTED]"];
      return [key, sanitize(item)];
    }));
  }
  if (typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return maskEmail(value);
  return value;
}

function json(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(sanitize(value))) as Prisma.InputJsonValue;
}

export const auditService = {
  async log(input: AuditInput) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId: input.actor_id,
          action: input.action,
          entityType: input.entity_type,
          entityId: input.entity_id,
          before: json(input.before),
          after: json(input.after),
          metadata: json(input.metadata),
        },
      });
    } catch (error) {
      console.error("audit_log_failed", error);
    }
  },
};
