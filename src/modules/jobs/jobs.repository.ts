import { prisma } from "../../database/prisma.js";
import { jobFieldMap } from "../../shared/repositories/field-maps.js";
import { createPrismaRepository } from "../../shared/repositories/prisma.repository.js";
import type { Job } from "../../shared/types/domain.js";

export const jobsRepository = createPrismaRepository<Job>(prisma.job, "job", jobFieldMap);
