import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ path: ".env.local" });
config();

const prisma = new PrismaClient();

const checks = [
  ["workspaces", () => prisma.workspace.count()],
  ["auth_refresh_tokens", () => prisma.authRefreshToken.count()],
  ["audit_logs", () => prisma.auditLog.count()],
  ["products.workspace_id", () => prisma.product.count({ where: { workspaceId: { not: null } } })],
  ["media_assets.workspace_id", () => prisma.mediaAsset.count({ where: { workspaceId: { not: null } } })],
  ["posts.workspace_id", () => prisma.post.count({ where: { workspaceId: { not: null } } })],
  ["platform_accounts.workspace_id", () => prisma.platformAccount.count({ where: { workspaceId: { not: null } } })],
  ["marketplace_listings.workspace_id", () => prisma.marketplaceListing.count({ where: { workspaceId: { not: null } } })],
];

try {
  console.log("Verificando tabelas e campos de segurança...");
  for (const [label, check] of checks) {
    const count = await check();
    console.log(`OK ${label}: ${count}`);
  }
  console.log("Verificação de banco concluída.");
} catch (error) {
  console.error("Falha na verificação do banco:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
