import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../errors/AppError.js";

const maxAgeMs = 10 * 60 * 1000;

type OAuthStatePayload = {
  platform: string;
  workspace_id: string;
  created_at: number;
};

function sign(value: string) {
  return createHmac("sha256", env.JWT_SECRET).update(value).digest("base64url");
}

export function createSignedOAuthState(payload: Omit<OAuthStatePayload, "created_at">) {
  const data = {
    ...payload,
    created_at: Date.now(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function parseSignedOAuthState(state?: string): OAuthStatePayload {
  if (!state) {
    throw new AppError("State OAuth ausente", 400, "OAUTH_STATE_MISSING");
  }

  const [encodedPayload, encodedSignature] = state.split(".");
  if (!encodedPayload || !encodedSignature) {
    throw new AppError("State OAuth invalido", 400, "OAUTH_STATE_INVALID");
  }

  const expectedSignature = sign(encodedPayload);
  const validSignature = timingSafeEqual(
    Buffer.from(encodedSignature),
    Buffer.from(expectedSignature),
  );

  if (!validSignature) {
    throw new AppError("State OAuth invalido", 400, "OAUTH_STATE_INVALID");
  }

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as OAuthStatePayload;
  } catch {
    throw new AppError("State OAuth invalido", 400, "OAUTH_STATE_INVALID");
  }

  if (!payload.workspace_id || !payload.platform || !payload.created_at) {
    throw new AppError("State OAuth incompleto", 400, "OAUTH_STATE_INVALID");
  }

  if (Date.now() - payload.created_at > maxAgeMs) {
    throw new AppError("State OAuth expirado", 400, "OAUTH_STATE_EXPIRED");
  }

  return payload;
}
