import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ path: ".env.local" });
config();

const prisma = new PrismaClient();
const workspaceId = process.env.DEFAULT_WORKSPACE_ID || "workspace_automedia";

const platforms = ["instagram", "tiktok", "facebook", "youtube", "shopee", "mercadolivre"];

try {
  const workspace = await prisma.workspace.upsert({
    where: { id: workspaceId },
    update: {},
    create: { id: workspaceId, name: "AutoMedia", slug: "automedia" },
  });

  await Promise.all([
    prisma.user.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
    prisma.product.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
    prisma.mediaAsset.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
    prisma.post.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
    prisma.comment.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
    prisma.job.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
    prisma.platformAccount.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
    prisma.salesOrder.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
    prisma.expense.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
    prisma.marketplaceListing.updateMany({ where: { workspaceId: null }, data: { workspaceId: workspace.id } }),
  ]);

  for (const platform of platforms) {
    await prisma.platformAccount.upsert({
      where: { workspaceId_platform: { workspaceId: workspace.id, platform } },
      update: {},
      create: {
        workspaceId: workspace.id,
        platform,
        accountName: platform === "mercadolivre" ? "Mercado Livre" : platform.charAt(0).toUpperCase() + platform.slice(1),
        status: "disconnected",
      },
    });
  }

  console.log(`Workspace de segurança aplicado: ${workspace.id}`);
} catch (error) {
  console.error("Falha no backfill de workspace:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
