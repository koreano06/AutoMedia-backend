import { AppError } from "../errors/AppError.js";
import { applyLimit, createId, matchesFilter, nowIso, sortByDate } from "../store/in-memory-db.js";

type EntityBase = { id: string; created_at?: string; updated_at?: string };

export function createMemoryRepository<T extends EntityBase>(collection: T[], idPrefix: string) {
  return {
    list(order = "-created_at", limit?: number) {
      return applyLimit(sortByDate(collection, order), limit);
    },

    filter(filter: Partial<T>, order = "-created_at", limit?: number) {
      const filtered = collection.filter((item) => matchesFilter(item as Record<string, unknown>, filter as Record<string, unknown>));
      return applyLimit(sortByDate(filtered, order), limit);
    },

    findById(id: string) {
      return collection.find((item) => item.id === id) || null;
    },

    create(payload: Omit<T, "id"> | Partial<T>) {
      const now = nowIso();
      const entity = {
        ...payload,
        id: createId(idPrefix),
        created_at: now,
        updated_at: now,
      } as T;
      collection.unshift(entity);
      return entity;
    },

    update(id: string, payload: Partial<T>) {
      const index = collection.findIndex((item) => item.id === id);
      if (index < 0) throw new AppError(`${idPrefix} não encontrado`, 404, "NOT_FOUND");

      collection[index] = {
        ...collection[index],
        ...payload,
        updated_at: nowIso(),
      };
      return collection[index];
    },

    delete(id: string) {
      const index = collection.findIndex((item) => item.id === id);
      if (index < 0) throw new AppError(`${idPrefix} não encontrado`, 404, "NOT_FOUND");
      const [removed] = collection.splice(index, 1);
      return removed;
    },
  };
}
