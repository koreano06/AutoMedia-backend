import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditService: {
    log: vi.fn(),
  },
  jobsRepository: {
    create: vi.fn(),
  },
  productsRepository: {
    create: vi.fn(),
    delete: vi.fn(),
    filter: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../audit/audit.service.js", () => ({ auditService: mocks.auditService }));
vi.mock("../jobs/jobs.repository.js", () => ({ jobsRepository: mocks.jobsRepository }));
vi.mock("./products.repository.js", () => ({ productsRepository: mocks.productsRepository }));

const { productsService } = await import("./products.service.js");

describe("productsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates products scoped to workspace and owner", async () => {
    mocks.productsRepository.create.mockResolvedValueOnce({ id: "product_1" });

    await productsService.create({ name: "Panela eletrica", attributes: { color: "black" } }, "user_1", "workspace_1");

    expect(mocks.productsRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      attributes: {
        color: "black",
        owner_user_id: "user_1",
      },
      media_count: 0,
      name: "Panela eletrica",
      posts_published: 0,
      status: "analyzing",
      videos_generated: 0,
      workspace_id: "workspace_1",
    }));
  });

  it("blocks updates across workspaces", async () => {
    mocks.productsRepository.findById.mockResolvedValueOnce({
      id: "product_1",
      workspace_id: "workspace_a",
    });

    await expect(productsService.update("product_1", { status: "review" }, "workspace_b")).rejects.toMatchObject({
      code: "WORKSPACE_FORBIDDEN",
      statusCode: 403,
    });
  });

  it("deletes products after workspace validation and writes audit log", async () => {
    const product = { id: "product_1", name: "Produto", workspace_id: "workspace_1" };
    mocks.productsRepository.findById.mockResolvedValueOnce(product);
    mocks.productsRepository.delete.mockResolvedValueOnce(product);

    await productsService.delete("product_1", "user_1", "workspace_1");

    expect(mocks.productsRepository.delete).toHaveBeenCalledWith("product_1");
    expect(mocks.auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      action: "product.delete",
      actor_id: "user_1",
      before: product,
      entity_id: "product_1",
      entity_type: "product",
    }));
  });

  it("creates an analysis job when analyzing a new product source", async () => {
    mocks.productsRepository.create.mockResolvedValueOnce({
      id: "product_1",
      name: "Anuncio em analise",
      workspace_id: "workspace_1",
    });
    mocks.jobsRepository.create.mockResolvedValueOnce({ id: "job_1" });

    const result = await productsService.analyze({ source_url: "https://example.com/produto" }, "user_1", "workspace_1");

    expect(result.job).toEqual({ id: "job_1" });
    expect(mocks.productsRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      input_source: "product_url",
      source_url: "https://example.com/produto",
      status: "analyzing",
      workspace_id: "workspace_1",
    }));
    expect(mocks.jobsRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      product_id: "product_1",
      status: "queued",
      type: "product_analysis",
      workspace_id: "workspace_1",
    }));
  });
});

