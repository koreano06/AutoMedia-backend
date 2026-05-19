import { prisma } from "../../database/prisma.js";
import { mediaAssetFieldMap } from "../../shared/repositories/field-maps.js";
import { createPrismaRepository } from "../../shared/repositories/prisma.repository.js";
import type { MediaAsset } from "../../shared/types/domain.js";

export const mediaRepository = createPrismaRepository<MediaAsset>(prisma.mediaAsset, "asset", mediaAssetFieldMap);
