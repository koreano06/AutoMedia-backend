import { prisma } from "../../database/prisma.js";
import { commentFieldMap } from "../../shared/repositories/field-maps.js";
import { createPrismaRepository } from "../../shared/repositories/prisma.repository.js";
import type { Comment } from "../../shared/types/domain.js";

export const commentsRepository = createPrismaRepository<Comment>(prisma.comment, "comment", commentFieldMap);
