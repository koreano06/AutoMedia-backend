import { db } from "../../shared/store/in-memory-db.js";
import { createMemoryRepository } from "../../shared/repositories/memory.repository.js";
import type { Post } from "../../shared/types/domain.js";

export const postsRepository = createMemoryRepository<Post>(db.posts, "post");
