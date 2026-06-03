import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  commentsRepository: {
    create: vi.fn(),
    delete: vi.fn(),
    filter: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
  },
  productsRepository: {
    findById: vi.fn(),
  },
}));

vi.mock("./comments.repository.js", () => ({ commentsRepository: mocks.commentsRepository }));
vi.mock("../products/products.repository.js", () => ({ productsRepository: mocks.productsRepository }));

const { commentsService } = await import("./comments.service.js");

describe("commentsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects purchase intent when creating comments", async () => {
    mocks.commentsRepository.create.mockResolvedValueOnce({ id: "comment_1" });

    await commentsService.create({ content: "eu quero o link", platform: "instagram" }, "workspace_1");

    expect(mocks.commentsRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      workspace_id: "workspace_1",
      is_purchase_intent: true,
      auto_replied: false,
    }));
  });

  it("blocks updates across workspaces", async () => {
    mocks.commentsRepository.findById.mockResolvedValueOnce({ id: "comment_1", workspace_id: "workspace_a" });

    await expect(commentsService.update("comment_1", { auto_replied: true }, "workspace_b")).rejects.toMatchObject({
      code: "WORKSPACE_FORBIDDEN",
      statusCode: 403,
    });
  });

  it("auto replies with product affiliate link", async () => {
    mocks.commentsRepository.findById.mockResolvedValueOnce({
      id: "comment_1",
      content: "quanto custa?",
      workspace_id: "workspace_1",
    });
    mocks.productsRepository.findById.mockResolvedValueOnce({
      id: "product_1",
      workspace_id: "workspace_1",
      affiliate_url: "https://example.com/affiliate",
    });
    mocks.commentsRepository.update.mockResolvedValueOnce({ id: "comment_1", auto_replied: true });

    await commentsService.autoReply({
      comment_id: "comment_1",
      product_id: "product_1",
      reply_template: "Aqui esta: {{product_url}}",
    }, "workspace_1");

    expect(mocks.commentsRepository.update).toHaveBeenCalledWith("comment_1", expect.objectContaining({
      auto_replied: true,
      reply_content: "Aqui esta: https://example.com/affiliate",
      is_purchase_intent: true,
    }));
  });
});
