import { db } from "../../shared/store/in-memory-db.js";
import { createMemoryRepository } from "../../shared/repositories/memory.repository.js";
import type { Comment } from "../../shared/types/domain.js";

export const commentsRepository = createMemoryRepository<Comment>(db.comments, "comment");
