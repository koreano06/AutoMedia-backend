import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { loginSchema, logoutSchema, refreshTokenSchema } from "./auth.schemas.js";
import { authService } from "./auth.service.js";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/login", { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } }, async (request) => authService.login(loginSchema.parse(request.body), {
    ip: request.ip,
    user_agent: request.headers["user-agent"],
  }));
  app.post("/refresh", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request) => {
    const { refresh_token } = refreshTokenSchema.parse(request.body);
    return authService.refresh(refresh_token);
  });
  app.get("/me", { preHandler: authMiddleware }, async (request) => authService.me(request.user!.id));
  app.post("/logout", async (request) => authService.logout(logoutSchema.parse(request.body).refresh_token));
}
