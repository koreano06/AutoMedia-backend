import { jobsRepository } from "./jobs.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { Job } from "../../shared/types/domain.js";

export const jobsService = {
  list(workspaceId?: string) {
    if (workspaceId) return jobsRepository.filter({ workspace_id: workspaceId }, "-created_at", 100);
    return jobsRepository.list("-created_at", 100);
  },

  async get(id: string, workspaceId?: string) {
    const job = await jobsRepository.findById(id);
    if (!job) throw new AppError("Job não encontrado", 404, "JOB_NOT_FOUND");
    if (workspaceId && job.workspace_id && job.workspace_id !== workspaceId) throw new AppError("Job não pertence a este workspace", 403, "WORKSPACE_FORBIDDEN");
    return job;
  },

  create(payload: Partial<Job>, workspaceId?: string) {
    return jobsRepository.create({ status: "queued", progress: 0, workspace_id: workspaceId, ...payload });
  },

  async update(id: string, payload: Partial<Job>, workspaceId?: string) {
    const job = await jobsRepository.findById(id);
    if (!job) throw new AppError("Job não encontrado", 404, "JOB_NOT_FOUND");
    if (workspaceId && job.workspace_id && job.workspace_id !== workspaceId) throw new AppError("Job não pertence a este workspace", 403, "WORKSPACE_FORBIDDEN");
    return jobsRepository.update(id, payload);
  },

  async delete(id: string, workspaceId?: string) {
    const job = await jobsRepository.findById(id);
    if (!job) throw new AppError("Job não encontrado", 404, "JOB_NOT_FOUND");
    if (workspaceId && job.workspace_id && job.workspace_id !== workspaceId) throw new AppError("Job não pertence a este workspace", 403, "WORKSPACE_FORBIDDEN");
    return jobsRepository.delete(id);
  },
};
