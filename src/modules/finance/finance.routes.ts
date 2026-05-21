import type { FastifyInstance } from "fastify";
import { created } from "../../shared/http/reply.js";
import { expensePayloadSchema, salesOrderPayloadSchema } from "./finance.schemas.js";
import { financeService } from "./finance.service.js";

export async function registerFinanceRoutes(app: FastifyInstance) {
  app.get("/summary", async () => financeService.summary());

  app.get("/orders", async (request) => {
    const query = request.query as { order?: string; limit?: string };
    return financeService.listOrders(query.order, query.limit ? Number(query.limit) : undefined);
  });

  app.post("/orders", async (request, reply) => {
    return created(reply, await financeService.createOrder(salesOrderPayloadSchema.parse(request.body)));
  });

  app.get("/expenses", async (request) => {
    const query = request.query as { order?: string; limit?: string };
    return financeService.listExpenses(query.order, query.limit ? Number(query.limit) : undefined);
  });

  app.post("/expenses", async (request, reply) => {
    return created(reply, await financeService.createExpense(expensePayloadSchema.parse(request.body)));
  });
}
