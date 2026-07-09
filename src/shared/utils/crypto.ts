import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../../config/env.js";

const prefix = "enc:v1:";

function key() {
  const source = env.ENCRYPTION_KEY || (env.NODE_ENV === "production" ? undefined : env.JWT_SECRET);
  if (!source) {
    throw new Error("ENCRYPTION_KEY precisa estar configurada para criptografar segredos fora do ambiente local.");
  }
  return createHash("sha256").update(source).digest();
}

export function encryptSecret(value?: string | null) {
  if (!value) return value ?? null;
  if (value.startsWith(prefix)) return value;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${prefix}${Buffer.concat([iv, tag, encrypted]).toString("base64url")}`;
}

export function decryptSecret(value?: string | null) {
  if (!value) return value ?? undefined;
  if (!value.startsWith(prefix)) return value;

  const payload = Buffer.from(value.slice(prefix.length), "base64url");
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
