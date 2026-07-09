import { prisma } from "../../database/prisma.js";
import type { Prisma } from "@prisma/client";
import { redactSensitiveValue } from "../../shared/utils/redact.js";

type AuditInput = {
  actor_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
};

function json(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(redactSensitiveValue(value))) as Prisma.InputJsonValue;
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
