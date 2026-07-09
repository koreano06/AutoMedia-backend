import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ path: ".env.local" });
config();

const prisma = new PrismaClient();

const checks = [
  ["workspaces", () => prisma.workspace.count()],
  ["auth_refresh_tokens", () => prisma.authRefreshToken.count()],
  ["audit_logs", () => prisma.auditLog.count()],
  ["users.workspace_id_missing", () => prisma.user.count({ where: { workspaceId: null } })],
  ["products.workspace_id_missing", () => prisma.product.count({ where: { workspaceId: null } })],
  ["media_assets.workspace_id_missing", () => prisma.mediaAsset.count({ where: { workspaceId: null } })],
  ["posts.workspace_id_missing", () => prisma.post.count({ where: { workspaceId: null } })],
  ["comments.workspace_id_missing", () => prisma.comment.count({ where: { workspaceId: null } })],
  ["jobs.workspace_id_missing", () => prisma.job.count({ where: { workspaceId: null } })],
  ["platform_accounts.workspace_id_missing", () => prisma.platformAccount.count({ where: { workspaceId: null } })],
  ["marketplace_listings.workspace_id_missing", () => prisma.marketplaceListing.count({ where: { workspaceId: null } })],
  ["sales_orders.workspace_id_missing", () => prisma.salesOrder.count({ where: { workspaceId: null } })],
  ["expenses.workspace_id_missing", () => prisma.expense.count({ where: { workspaceId: null } })],
];

try {
  console.log("Verificando tabelas e campos de segurança...");
  for (const [label, check] of checks) {
    const count = await check();
    if (String(label).endsWith("_missing") && count > 0) {
      throw new Error(`${label} possui ${count} registro(s) sem workspace_id.`);
    }
    console.log(`OK ${label}: ${count}`);
  }
  console.log("Verificação de banco concluída.");
} catch (error) {
  console.error("Falha na verificação do banco:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
