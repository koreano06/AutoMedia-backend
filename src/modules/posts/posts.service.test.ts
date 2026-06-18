import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mediaRepository: {
    findById: vi.fn(),
  },
  platformsService: {
    publish: vi.fn(),
  },
  auditService: {
    log: vi.fn(),
  },
  postsRepository: {
    create: vi.fn(),
    delete: vi.fn(),
    filter: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
  },
  prisma: {
    post: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../../database/prisma.js", () => ({ prisma: mocks.prisma }));
vi.mock("../audit/audit.service.js", () => ({ auditService: mocks.auditService }));
vi.mock("../media/media.repository.js", () => ({ mediaRepository: mocks.mediaRepository }));
vi.mock("../platforms/platforms.service.js", () => ({ platformsService: mocks.platformsService }));
vi.mock("./posts.repository.js", () => ({ postsRepository: mocks.postsRepository }));

const { postsService } = await import("./posts.service.js");

describe("postsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates one scheduled post per selected platform from an approved media asset", async () => {
    mocks.mediaRepository.findById.mockResolvedValueOnce({
      id: "asset_1",
      workspace_id: "workspace_1",
      product_id: "product_1",
      product_name: "Produto",
      caption: "Legenda base",
      thumbnail_url: "https://example.com/thumb.jpg",
    });
    mocks.postsRepository.create.mockImplementation(async (payload) => ({ id: `post_${payload.platform}`, ...payload }));

    const result = await postsService.schedule({
      media_asset_id: "asset_1",
      platforms: ["instagram", "tiktok"],
      caption: "",
      schedule_mode: "scheduled",
      scheduled_at: "2026-06-03T18:00:00.000Z",
    }, "workspace_1");

    expect(result).toHaveLength(2);
    expect(mocks.postsRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      platform: "instagram",
      caption: "Legenda base",
      status: "scheduled",
      workspace_id: "workspace_1",
    }));
  });

  it("lists due posts without publishing in dry-run mode", async () => {
    mocks.prisma.post.findMany.mockResolvedValueOnce([
      {
        id: "post_1",
        platform: "instagram",
        productName: "Produto",
        scheduledAt: new Date("2026-06-03T10:00:00.000Z"),
      },
    ]);

    const result = await postsService.publishDue({ limit: 5, dry_run: true }, "workspace_1");

    expect(result).toEqual({
      dry_run: true,
      total: 1,
      posts: [{
        id: "post_1",
        platform: "instagram",
        product_name: "Produto",
        scheduled_at: "2026-06-03T10:00:00.000Z",
      }],
    });
    expect(mocks.platformsService.publish).not.toHaveBeenCalled();
  });

  it("blocks publishing posts from another workspace", async () => {
    mocks.postsRepository.findById.mockResolvedValueOnce({
      id: "post_1",
      workspace_id: "workspace_a",
      platform: "instagram",
    });

    await expect(postsService.publishNow("post_1", "workspace_b")).rejects.toMatchObject({
      code: "WORKSPACE_FORBIDDEN",
      statusCode: 403,
    });
  });
});
