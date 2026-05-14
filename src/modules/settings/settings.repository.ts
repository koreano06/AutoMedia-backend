import { db } from "../../shared/store/in-memory-db.js";
import type { AutomationSettings } from "../../shared/types/domain.js";

export const settingsRepository = {
  getAutomation() {
    return db.settings;
  },

  updateAutomation(payload: Partial<AutomationSettings>) {
    db.settings = { ...db.settings, ...payload };
    return db.settings;
  },
};
