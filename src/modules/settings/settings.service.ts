import { settingsRepository } from "./settings.repository.js";
import type { AutomationSettings } from "../../shared/types/domain.js";

export const settingsService = {
  getAutomation() {
    return settingsRepository.getAutomation();
  },

  updateAutomation(payload: Partial<AutomationSettings>) {
    return settingsRepository.updateAutomation(payload);
  },
};
