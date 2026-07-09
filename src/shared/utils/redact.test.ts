import { describe, expect, it } from "vitest";
import { redactSensitiveValue, sanitizeExternalErrorPayload } from "./redact.js";

describe("redact utils", () => {
  it("redacts sensitive keys recursively", () => {
    expect(redactSensitiveValue({
      access_token: "secret-token",
      profile: {
        client_secret: "super-secret",
        email: "user@example.com",
      },
    })).toEqual({
      access_token: "[REDACTED]",
      profile: {
        client_secret: "[REDACTED]",
        email: "u***@example.com",
      },
    });
  });

  it("sanitizes external payloads without exposing secrets", () => {
    const result = sanitizeExternalErrorPayload({
      error: "invalid_request",
      refresh_token: "token-value",
    });

    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("token-value");
  });
});
