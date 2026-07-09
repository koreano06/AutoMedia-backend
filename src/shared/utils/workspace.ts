import { AppError } from "../errors/AppError.js";

export function requireWorkspaceId(workspaceId?: string | null) {
  if (!workspaceId) {
    throw new AppError("Workspace obrigatorio para esta operacao", 403, "WORKSPACE_REQUIRED");
  }

  return workspaceId;
}
