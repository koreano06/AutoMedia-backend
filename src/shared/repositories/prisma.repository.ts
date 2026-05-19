import { AppError } from "../errors/AppError.js";

type EntityBase = { id: string; created_at?: string; updated_at?: string };

type PrismaModel = {
  findMany(args?: unknown): Promise<unknown[]>;
  findUnique(args: unknown): Promise<unknown | null>;
  create(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  delete(args: unknown): Promise<unknown>;
};

type FieldMap = Record<string, string>;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDecimalLike(value: unknown) {
  return isObject(value) && typeof value.toString === "function" && (value as { constructor?: { name?: string } }).constructor?.name === "Decimal";
}

function serializeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (isDecimalLike(value)) return Number((value as { toString(): string }).toString());
  if (Array.isArray(value)) return value.map(serializeValue);
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeValue(item)]));
  }

  return value;
}

function mapFields(payload: Record<string, unknown>, fieldMap: FieldMap) {
  return Object.fromEntries(
    Object.entries(payload)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [fieldMap[key] || key, value]),
  );
}

function orderBy(order = "-created_at", fieldMap: FieldMap) {
  const direction = order.startsWith("-") ? "desc" : "asc";
  const field = order.replace("-", "");
  return { [fieldMap[field] || field]: direction };
}

function fromPrisma<T>(payload: unknown, reverseFieldMap: FieldMap): T {
  if (!isObject(payload)) return payload as T;

  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [reverseFieldMap[key] || key, serializeValue(value)]),
  ) as T;
}

export function createPrismaRepository<T extends EntityBase>(model: PrismaModel, idPrefix: string, fieldMap: FieldMap = {}) {
  const reverseFieldMap = Object.fromEntries(Object.entries(fieldMap).map(([apiField, prismaField]) => [prismaField, apiField]));

  return {
    async list(order = "-created_at", limit?: number) {
      const records = await model.findMany({
        orderBy: orderBy(order, fieldMap),
        ...(limit ? { take: limit } : {}),
      });

      return records.map((record) => fromPrisma<T>(record, reverseFieldMap));
    },

    async filter(filter: Partial<T>, order = "-created_at", limit?: number) {
      const records = await model.findMany({
        where: mapFields(filter as Record<string, unknown>, fieldMap),
        orderBy: orderBy(order, fieldMap),
        ...(limit ? { take: limit } : {}),
      });

      return records.map((record) => fromPrisma<T>(record, reverseFieldMap));
    },

    async findById(id: string) {
      const record = await model.findUnique({ where: { id } });
      return record ? fromPrisma<T>(record, reverseFieldMap) : null;
    },

    async create(payload: Omit<T, "id"> | Partial<T>) {
      const record = await model.create({
        data: mapFields(payload as Record<string, unknown>, fieldMap),
      });

      return fromPrisma<T>(record, reverseFieldMap);
    },

    async update(id: string, payload: Partial<T>) {
      try {
        const record = await model.update({
          where: { id },
          data: mapFields(payload as Record<string, unknown>, fieldMap),
        });

        return fromPrisma<T>(record, reverseFieldMap);
      } catch {
        throw new AppError(`${idPrefix} não encontrado`, 404, "NOT_FOUND");
      }
    },

    async delete(id: string) {
      try {
        const record = await model.delete({ where: { id } });
        return fromPrisma<T>(record, reverseFieldMap);
      } catch {
        throw new AppError(`${idPrefix} não encontrado`, 404, "NOT_FOUND");
      }
    },
  };
}
