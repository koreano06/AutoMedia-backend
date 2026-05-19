import { prisma } from "../../database/prisma.js";
import { productFieldMap } from "../../shared/repositories/field-maps.js";
import { createPrismaRepository } from "../../shared/repositories/prisma.repository.js";
import type { Product } from "../../shared/types/domain.js";

export const productsRepository = createPrismaRepository<Product>(prisma.product, "prod", productFieldMap);
