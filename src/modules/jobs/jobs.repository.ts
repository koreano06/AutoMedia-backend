import { db } from "../../shared/store/in-memory-db.js";
import { createMemoryRepository } from "../../shared/repositories/memory.repository.js";
import type { Job } from "../../shared/types/domain.js";

export const jobsRepository = createMemoryRepository<Job>(db.jobs, "job");
