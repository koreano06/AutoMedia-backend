import { describe, expect, it } from "vitest";
import { requireWorkspaceId } from "./workspace.js";

describe("workspace utils", () => {
  it("returns workspace when present", () => {
    expect(requireWorkspaceId("workspace_1")).toBe("workspace_1");
  });

  it("throws when workspace is missing", () => {
    expect(() => requireWorkspaceId(undefined)).toThrowError(/Workspace obrigatorio/);
  });
});
