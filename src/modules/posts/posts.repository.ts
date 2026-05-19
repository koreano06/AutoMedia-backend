import { prisma } from "../../database/prisma.js";
import { postFieldMap } from "../../shared/repositories/field-maps.js";
import { createPrismaRepository } from "../../shared/repositories/prisma.repository.js";
import type { Post } from "../../shared/types/domain.js";

export const postsRepository = createPrismaRepository<Post>(prisma.post, "post", postFieldMap);
