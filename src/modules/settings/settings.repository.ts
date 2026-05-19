import { prisma } from "../../database/prisma.js";
import type { AutomationSettings } from "../../shared/types/domain.js";

function toDomain(settings: {
  id: string;
  autoReply: boolean;
  autoSchedule: boolean;
  notifications: boolean;
  randomSchedule: boolean;
  purchaseKeywords: string[];
  postingStart: string;
  postingEnd: string;
  enabledPlatforms: string[];
}): AutomationSettings {
  return {
    id: settings.id,
    auto_reply: settings.autoReply,
    auto_schedule: settings.autoSchedule,
    notifications: settings.notifications,
    random_schedule: settings.randomSchedule,
    purchase_keywords: settings.purchaseKeywords,
    posting_start: settings.postingStart,
    posting_end: settings.postingEnd,
    enabled_platforms: settings.enabledPlatforms,
  };
}

function toPrismaPayload(payload: Partial<AutomationSettings>) {
  return {
    autoReply: payload.auto_reply,
    autoSchedule: payload.auto_schedule,
    notifications: payload.notifications,
    randomSchedule: payload.random_schedule,
    purchaseKeywords: payload.purchase_keywords,
    postingStart: payload.posting_start,
    postingEnd: payload.posting_end,
    enabledPlatforms: payload.enabled_platforms,
  };
}

export const settingsRepository = {
  async getAutomation() {
    const settings = await prisma.automationSetting.upsert({
      where: { id: "automation_settings" },
      update: {},
      create: { id: "automation_settings" },
    });

    return toDomain(settings);
  },

  async updateAutomation(payload: Partial<AutomationSettings>) {
    const settings = await prisma.automationSetting.upsert({
      where: { id: "automation_settings" },
      update: toPrismaPayload(payload),
      create: { id: "automation_settings", ...toPrismaPayload(payload) },
    });

    return toDomain(settings);
  },
};
