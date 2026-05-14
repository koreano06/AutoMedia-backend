import { db } from "../../shared/store/in-memory-db.js";
import { createMemoryRepository } from "../../shared/repositories/memory.repository.js";
import type { MediaAsset } from "../../shared/types/domain.js";

export const mediaRepository = createMemoryRepository<MediaAsset>(db.mediaAssets, "asset");
