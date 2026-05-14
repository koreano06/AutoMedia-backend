import { db } from "../../shared/store/in-memory-db.js";
import { createMemoryRepository } from "../../shared/repositories/memory.repository.js";
import type { Product } from "../../shared/types/domain.js";

export const productsRepository = createMemoryRepository<Product>(db.products, "prod");
