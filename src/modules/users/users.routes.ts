import type { FastifyInstance } from "fastify";
import { usersService } from "./users.service.js";

export async function registerUsersRoutes(app: FastifyInstance) {
  app.get("/", async () => usersService.list());
}
