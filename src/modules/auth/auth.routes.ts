import type { FastifyInstance } from "fastify";
import { loginSchema } from "./auth.schemas.js";
import { authService } from "./auth.service.js";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/login", async (request) => authService.login(loginSchema.parse(request.body)));
  app.get("/me", async () => authService.me());
  app.post("/logout", async () => ({ success: true }));
}
