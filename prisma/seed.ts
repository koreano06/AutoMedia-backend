import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const platforms = ["instagram", "tiktok", "facebook", "youtube", "shopee", "mercadolivre"];

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      name: "Administrador",
      username: "admin",
      passwordHash,
      role: "admin",
      storeName: "AutoMedia",
    },
  });

  await prisma.automationSetting.upsert({
    where: { id: "automation_settings" },
    update: {},
    create: {
      id: "automation_settings",
      autoReply: true,
      autoSchedule: true,
      notifications: true,
      randomSchedule: true,
      purchaseKeywords: ["eu quero", "quanto custa", "como comprar", "onde comprar", "link do produto"],
      postingStart: "08:00",
      postingEnd: "22:00",
      enabledPlatforms: platforms,
    },
  });

  await Promise.all(
    platforms.map((platform) =>
      prisma.platformAccount.upsert({
        where: { platform },
        update: {},
        create: {
          platform,
          accountName: platform === "mercadolivre" ? "Mercado Livre" : platform.charAt(0).toUpperCase() + platform.slice(1),
          status: "disconnected",
        },
      }),
    ),
  );

  const product = await prisma.product.upsert({
    where: { id: "seed_product_demo" },
    update: {},
    create: {
      id: "seed_product_demo",
      name: "Produto demonstrativo",
      inputSource: "manual",
      category: "Demo",
      description: "Produto inicial para validar o fluxo do AutoMedia.",
      status: "approved",
      price: "99.90",
      costPrice: "49.90",
      marginPercent: 50,
      stockQuantity: 20,
      minStock: 5,
      currency: "BRL",
      keywords: ["demo", "automedia"],
      attributes: { source: "seed" },
    },
  });

  const asset = await prisma.mediaAsset.upsert({
    where: { id: "seed_media_demo" },
    update: {},
    create: {
      id: "seed_media_demo",
      productId: product.id,
      productName: product.name,
      type: "generated_video",
      title: "Vídeo demonstrativo",
      status: "pending_review",
      source: "seed",
      url: "https://placehold.co/720x1280",
      thumbnailUrl: "https://placehold.co/720x1280",
      caption: "Conteúdo demonstrativo para aprovação.",
      platforms: ["instagram", "tiktok"],
      qualityScore: 82,
    },
  });

  await prisma.post.upsert({
    where: { id: "seed_post_demo" },
    update: {},
    create: {
      id: "seed_post_demo",
      productId: product.id,
      mediaAssetId: asset.id,
      productName: product.name,
      platform: "instagram",
      caption: "Conheça este produto demonstrativo.",
      status: "scheduled",
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      thumbnailUrl: asset.thumbnailUrl,
      campaignName: "Demo",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
