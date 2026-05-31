import type { FastifyInstance } from "fastify";
import { created } from "../../shared/http/reply.js";
import { expensePayloadSchema, salesOrderPayloadSchema } from "./finance.schemas.js";
import { financeService } from "./finance.service.js";
import { requireRole } from "../../shared/middlewares/auth.middleware.js";

export async function registerFinanceRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireRole(["admin"]));

  app.get("/summary", async (request) => financeService.summary(request.user?.workspace_id));

  app.get("/orders", async (request) => {
    const query = request.query as { order?: string; limit?: string };
    return financeService.listOrders(query.order, query.limit ? Number(query.limit) : undefined, request.user?.workspace_id);
  });

  app.post("/orders", async (request, reply) => {
    return created(reply, await financeService.createOrder(salesOrderPayloadSchema.parse(request.body), request.user?.id, request.user?.workspace_id));
  });

  app.get("/expenses", async (request) => {
    const query = request.query as { order?: string; limit?: string };
    return financeService.listExpenses(query.order, query.limit ? Number(query.limit) : undefined, request.user?.workspace_id);
  });

  app.post("/expenses", async (request, reply) => {
    return created(reply, await financeService.createExpense(expensePayloadSchema.parse(request.body), request.user?.id, request.user?.workspace_id));
  });
}
