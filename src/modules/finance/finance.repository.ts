import { prisma } from "../../database/prisma.js";
import { expenseFieldMap, salesOrderFieldMap } from "../../shared/repositories/field-maps.js";
import { createPrismaRepository } from "../../shared/repositories/prisma.repository.js";
import type { Expense, SalesOrder } from "../../shared/types/domain.js";

export const salesOrdersRepository = createPrismaRepository<SalesOrder>(prisma.salesOrder, "sales_order", salesOrderFieldMap);
export const expensesRepository = createPrismaRepository<Expense>(prisma.expense, "expense", expenseFieldMap);
