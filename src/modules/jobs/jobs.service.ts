import { jobsRepository } from "./jobs.repository.js";
import type { Job } from "../../shared/types/domain.js";

export const jobsService = {
  list(workspaceId?: string) {
    if (workspaceId) return jobsRepository.filter({ workspace_id: workspaceId }, "-created_at", 100);
    return jobsRepository.list("-created_at", 100);
  },

  get(id: string) {
    return jobsRepository.findById(id);
  },

  create(payload: Partial<Job>, workspaceId?: string) {
    return jobsRepository.create({ status: "queued", progress: 0, workspace_id: workspaceId, ...payload });
  },

  update(id: string, payload: Partial<Job>) {
    return jobsRepository.update(id, payload);
  },
};
