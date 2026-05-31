import type { FastifyInstance } from "fastify";
import { approveMediaSchema, rejectMediaSchema } from "./approvals.schemas.js";
import { approvalsService } from "./approvals.service.js";

export async function registerApprovalsRoutes(app: FastifyInstance) {
  app.post("/approve", async (request) => approvalsService.approve(approveMediaSchema.parse(request.body), request.user?.id));
  app.post("/reject", async (request) => approvalsService.reject(rejectMediaSchema.parse(request.body), request.user?.id));
}
