import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const platforms = ["instagram", "tiktok", "facebook", "youtube", "shopee", "mercadolivre"];

const demoProducts = [
  {
    id: "seed_product_ring_light",
    name: "Ring Light LED 26cm com Tripé",
    category: "Iluminação",
    description: "Ring light portátil para criadores de conteúdo, lives e vídeos de produto.",
    brand: "LumiPro",
    price: "129.90",
    costPrice: "72.50",
    marginPercent: 44.2,
    sku: "RL-26-TRIPE",
    supplierName: "Fornecedor Alpha",
    stockQuantity: 32,
    minStock: 8,
    marketplaceOrigin: "Shopee",
    productUrl: "https://example.com/produtos/ring-light",
    affiliateUrl: "https://example.com/afiliado/ring-light",
    keywords: ["ring light", "iluminacao", "criador de conteudo"],
    status: "approved",
  },
  {
    id: "seed_product_mini_projector",
    name: "Mini Projetor Portátil HD",
    category: "Eletrônicos",
    description: "Projetor compacto para filmes, apresentações e conteúdo em casa.",
    brand: "ViewGo",
    price: "349.90",
    costPrice: "221.00",
    marginPercent: 36.8,
    sku: "MP-HD-01",
    supplierName: "Tech Import",
    stockQuantity: 14,
    minStock: 5,
    marketplaceOrigin: "Mercado Livre",
    productUrl: "https://example.com/produtos/mini-projetor",
    affiliateUrl: "https://example.com/afiliado/mini-projetor",
    keywords: ["projetor", "cinema em casa", "eletronicos"],
    status: "review",
  },
  {
    id: "seed_product_organizer_bag",
    name: "Bolsa Organizadora de Viagem",
    category: "Casa e Viagem",
    description: "Bolsa dobrável com divisórias para roupas, acessórios e itens pessoais.",
    brand: "TravelZip",
    price: "79.90",
    costPrice: "38.40",
    marginPercent: 51.9,
    sku: "BZ-VIAGEM-03",
    supplierName: "Casa Mix",
    stockQuantity: 4,
    minStock: 10,
    marketplaceOrigin: "Shopee",
    productUrl: "https://example.com/produtos/bolsa-organizadora",
    affiliateUrl: "https://example.com/afiliado/bolsa-organizadora",
    keywords: ["organizador", "viagem", "bolsa"],
    status: "approved",
  },
];

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

  await prisma.campaign.upsert({
    where: { id: "seed_campaign_launch" },
    update: {},
    create: {
      id: "seed_campaign_launch",
      name: "Campanha de teste - Produtos virais",
      description: "Campanha inicial para testar geração, aprovação, agendamento e comentários.",
      status: "active",
      startAt: new Date(),
      endAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      metadata: { source: "seed" },
    },
  });

  const products = await Promise.all(
    demoProducts.map((product) =>
      prisma.product.upsert({
        where: { id: product.id },
        update: {},
        create: {
          ...product,
          inputSource: "manual",
          currency: "BRL",
          imageUrl: `https://placehold.co/900x900?text=${encodeURIComponent(product.name)}`,
          attributes: { source: "seed", audience: "criadores e afiliados" },
          mediaCount: 2,
          postsPublished: product.id === "seed_product_ring_light" ? 1 : 0,
          videosGenerated: 1,
        },
      }),
    ),
  );

  for (const [index, product] of products.entries()) {
    await prisma.productAnalysis.upsert({
      where: { id: `seed_analysis_${product.id}` },
      update: {},
      create: {
        id: `seed_analysis_${product.id}`,
        productId: product.id,
        provider: "demo-vision",
        inputType: "manual",
        confidence: 0.86 + index * 0.03,
        summary: `Produto identificado como ${product.category}, com potencial para vídeos curtos de demonstração.`,
        rawResponse: { source: "seed", tags: demoProducts[index].keywords },
      },
    });

    const image = await prisma.mediaAsset.upsert({
      where: { id: `seed_media_image_${product.id}` },
      update: {},
      create: {
        id: `seed_media_image_${product.id}`,
        productId: product.id,
        productName: product.name,
        type: "image",
        title: `Imagem principal - ${product.name}`,
        status: "approved",
        source: "seed",
        url: `https://placehold.co/900x900?text=${encodeURIComponent(product.name)}`,
        thumbnailUrl: `https://placehold.co/400x400?text=${encodeURIComponent(product.name)}`,
        caption: `Imagem de apoio para ${product.name}.`,
        platforms: ["instagram", "facebook", "shopee"],
        qualityScore: 78 + index * 5,
      },
    });

    const video = await prisma.mediaAsset.upsert({
      where: { id: `seed_media_video_${product.id}` },
      update: {},
      create: {
        id: `seed_media_video_${product.id}`,
        productId: product.id,
        productName: product.name,
        type: "generated_video",
        title: `Vídeo IA - ${product.name}`,
        status: index === 1 ? "pending_review" : "approved",
        source: "IA Gerada",
        url: `https://placehold.co/720x1280?text=${encodeURIComponent(`Video ${index + 1}`)}`,
        thumbnailUrl: `https://placehold.co/720x1280?text=${encodeURIComponent(product.name)}`,
        caption: `Veja como ${product.name} pode facilitar sua rotina. Peça o link nos comentários.`,
        platforms: ["instagram", "tiktok"],
        qualityScore: 82 + index * 4,
        duration: "30s",
      },
    });

    await prisma.mediaCollectionSource.upsert({
      where: { id: `seed_collection_${image.id}` },
      update: {},
      create: {
        id: `seed_collection_${image.id}`,
        mediaAssetId: image.id,
        sourceType: "web_image",
        sourceUrl: image.url,
        provider: "seed",
        status: "collected",
        metadata: { query: product.name },
      },
    });

    await prisma.approval.upsert({
      where: { id: `seed_approval_${video.id}` },
      update: {},
      create: {
        id: `seed_approval_${video.id}`,
        mediaAssetId: video.id,
        status: video.status,
        notes: video.status === "approved" ? "Conteúdo aprovado para teste." : "Aguardando revisão manual.",
        platforms: video.platforms,
      },
    });

    const scheduledPost = await prisma.post.upsert({
      where: { id: `seed_post_scheduled_${product.id}` },
      update: {},
      create: {
        id: `seed_post_scheduled_${product.id}`,
        productId: product.id,
        mediaAssetId: video.id,
        productName: product.name,
        platform: index === 2 ? "tiktok" : "instagram",
        caption: `Oferta teste: ${product.name}. Comente "eu quero" para receber o link.`,
        status: "scheduled",
        scheduledAt: new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000),
        thumbnailUrl: video.thumbnailUrl,
        campaignName: "Campanha de teste - Produtos virais",
      },
    });

    const publishedPost = await prisma.post.upsert({
      where: { id: `seed_post_published_${product.id}` },
      update: {},
      create: {
        id: `seed_post_published_${product.id}`,
        productId: product.id,
        mediaAssetId: image.id,
        productName: product.name,
        platform: "facebook",
        caption: `Teste publicado para ${product.name}.`,
        status: "published",
        publishedAt: new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000),
        externalPostId: `demo_external_${index + 1}`,
        externalUrl: `https://example.com/posts/${index + 1}`,
        engagementLikes: 40 + index * 17,
        engagementComments: 5 + index * 3,
        engagementShares: 2 + index,
        engagementReach: 900 + index * 420,
        thumbnailUrl: image.thumbnailUrl,
        campaignName: "Campanha de teste - Produtos virais",
        lastSyncAt: new Date(),
      },
    });

    await prisma.postMetric.create({
      data: {
        postId: publishedPost.id,
        likes: publishedPost.engagementLikes,
        comments: publishedPost.engagementComments,
        shares: publishedPost.engagementShares,
        reach: publishedPost.engagementReach,
        engagementRate: 4.2 + index,
      },
    });

    const comment = await prisma.comment.upsert({
      where: { id: `seed_comment_${product.id}` },
      update: {},
      create: {
        id: `seed_comment_${product.id}`,
        postId: publishedPost.id,
        externalCommentId: `demo_comment_${index + 1}`,
        author: ["Mariana", "Joao", "Carla"][index],
        content: index === 1 ? "Funciona mesmo? quanto custa?" : "Eu quero o link desse produto",
        platform: publishedPost.platform,
        isPurchaseIntent: true,
        autoReplied: index !== 1,
        replyContent: index !== 1 ? `Claro! Aqui esta o link: ${product.affiliateUrl || product.productUrl}` : null,
        detectedAt: new Date(Date.now() - index * 60 * 60 * 1000),
        repliedAt: index !== 1 ? new Date() : null,
      },
    });

    if (comment.autoReplied) {
      await prisma.commentReplyLog.create({
        data: {
          commentId: comment.id,
          provider: "seed-auto-reply",
          status: "sent",
          content: comment.replyContent,
        },
      });
    }

    await prisma.job.upsert({
      where: { id: `seed_job_${product.id}` },
      update: {},
      create: {
        id: `seed_job_${product.id}`,
        type: index === 0 ? "video_generation" : index === 1 ? "media_collection" : "post_publishing",
        status: index === 1 ? "processing" : "completed",
        title: `Job teste - ${product.name}`,
        progress: index === 1 ? 65 : 100,
        productId: product.id,
        mediaAssetId: video.id,
        postId: scheduledPost.id,
        resultUrl: video.url,
        payload: { source: "seed" },
        result: { ok: index !== 1 },
        completedAt: index === 1 ? null : new Date(),
      },
    });
  }
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
