import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AppError } from "../errors/AppError.js";
import { authMiddleware, requireRole } from "./auth.middleware.js";

describe("security middleware", () => {
  it("blocks private routes without bearer token", async () => {
    const request = {
      method: "GET",
      url: "/api/products",
      headers: {},
    };

    await expect(authMiddleware(request as never, {} as never)).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
      statusCode: 401,
    });
  });

  it("blocks users without the required role", async () => {
    const guard = requireRole(["admin"]);
    const request = { user: { id: "user_1", role: "user" } };

    await expect(guard(request as never, {} as never)).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
  });

  it("accepts valid automedia webhook signatures", async () => {
    process.env.WEBHOOK_SECRET = "test-webhook-secret";
    const { verifyWebhookSignature } = await import("./webhook-signature.middleware.js");
    const body = { event: "ping" };
    const signature = createHmac("sha256", process.env.WEBHOOK_SECRET).update(JSON.stringify(body)).digest("hex");
    const request = {
      body,
      headers: { "x-automedia-signature": signature },
      ip: "127.0.0.1",
      url: "/api/webhooks/test",
    };

    await expect(verifyWebhookSignature(request as never, {} as never)).resolves.toBeUndefined();
  });

  it("uses AppError for permission failures", async () => {
    const guard = requireRole(["admin"]);
    await expect(guard({} as never, {} as never)).rejects.toBeInstanceOf(AppError);
  });
});
