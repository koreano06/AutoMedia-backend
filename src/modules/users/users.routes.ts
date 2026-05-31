import type { FastifyInstance } from "fastify";
import { usersService } from "./users.service.js";
import { requireRole } from "../../shared/middlewares/auth.middleware.js";

export async function registerUsersRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireRole(["admin"]));

  app.get("/", async () => usersService.list());
}
