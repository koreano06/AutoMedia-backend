import { jobsRepository } from "./jobs.repository.js";
import type { Job } from "../../shared/types/domain.js";

export const jobsService = {
  list() {
    return jobsRepository.list("-created_at", 100);
  },

  get(id: string) {
    return jobsRepository.findById(id);
  },

  create(payload: Partial<Job>) {
    return jobsRepository.create({ status: "queued", progress: 0, ...payload });
  },

  update(id: string, payload: Partial<Job>) {
    return jobsRepository.update(id, payload);
  },
};
