import { prisma } from "../../database/prisma.js";
import { marketplaceListingFieldMap } from "../../shared/repositories/field-maps.js";
import { createPrismaRepository } from "../../shared/repositories/prisma.repository.js";
import type { MarketplaceListing } from "../../shared/types/domain.js";

export const marketplaceListingsRepository = createPrismaRepository<MarketplaceListing>(
  prisma.marketplaceListing,
  "marketplace_listing",
  marketplaceListingFieldMap,
);
