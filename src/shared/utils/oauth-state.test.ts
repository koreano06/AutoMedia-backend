import { describe, expect, it, vi } from "vitest";
import { createSignedOAuthState, parseSignedOAuthState } from "./oauth-state.js";

describe("oauth state utils", () => {
  it("creates and validates signed state", () => {
    const state = createSignedOAuthState({ platform: "instagram", workspace_id: "workspace_1" });
    expect(parseSignedOAuthState(state)).toMatchObject({
      platform: "instagram",
      workspace_id: "workspace_1",
    });
  });

  it("rejects expired state", () => {
    vi.useFakeTimers();
    const state = createSignedOAuthState({ platform: "instagram", workspace_id: "workspace_1" });
    vi.advanceTimersByTime(11 * 60 * 1000);
    expect(() => parseSignedOAuthState(state)).toThrowError(/expirado/);
    vi.useRealTimers();
  });
});
