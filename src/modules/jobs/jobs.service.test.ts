import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  jobsRepository: {
    create: vi.fn(),
    delete: vi.fn(),
    filter: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
  },
  mediaRepository: {
    findById: vi.fn(),
    update: vi.fn(),
  },
  productsRepository: {
    findById: vi.fn(),
  },
  enqueueVideoGeneration: vi.fn(),
  auditService: {
    log: vi.fn(),
  },
}));

vi.mock("./jobs.repository.js", () => ({ jobsRepository: mocks.jobsRepository }));
vi.mock("../audit/audit.service.js", () => ({ auditService: mocks.auditService }));
vi.mock("../media/media.repository.js", () => ({ mediaRepository: mocks.mediaRepository }));
vi.mock("../products/products.repository.js", () => ({ productsRepository: mocks.productsRepository }));
vi.mock("../videos/video-generation.queue.js", () => ({ enqueueVideoGeneration: mocks.enqueueVideoGeneration }));

const { jobsService } = await import("./jobs.service.js");

describe("jobsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates queued jobs scoped to a workspace", async () => {
    mocks.jobsRepository.create.mockResolvedValueOnce({ id: "job_1" });

    await jobsService.create({ type: "video_generation", title: "Gerar video" }, "workspace_1");

    expect(mocks.jobsRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      workspace_id: "workspace_1",
      status: "queued",
      progress: 0,
      type: "video_generation",
    }));
  });

  it("blocks reads across workspaces", async () => {
    mocks.jobsRepository.findById.mockResolvedValueOnce({ id: "job_1", workspace_id: "workspace_a" });

    await expect(jobsService.get("job_1", "workspace_b")).rejects.toMatchObject({
      code: "WORKSPACE_FORBIDDEN",
      statusCode: 403,
    });
  });

  it("deletes jobs only after workspace validation", async () => {
    mocks.jobsRepository.findById.mockResolvedValueOnce({ id: "job_1", workspace_id: "workspace_1" });
    mocks.jobsRepository.delete.mockResolvedValueOnce({ id: "job_1" });

    await jobsService.delete("job_1", "workspace_1");

    expect(mocks.jobsRepository.delete).toHaveBeenCalledWith("job_1");
  });

  it("reenqueues failed video generation jobs", async () => {
    mocks.jobsRepository.findById.mockResolvedValueOnce({
      id: "job_1",
      type: "video_generation",
      status: "failed",
      workspace_id: "workspace_1",
      media_asset_id: "asset_1",
      payload: { ratio: "9:16" },
    });
    mocks.mediaRepository.findById.mockResolvedValueOnce({
      id: "asset_1",
      workspace_id: "workspace_1",
      product_id: "product_1",
      product_name: "Produto teste",
      caption: "Roteiro",
      thumbnail_url: "https://media.local/thumb.jpg",
      metadata: {
        render_plan: {
          engine: "ffmpeg-scene-composer",
          format: "reels",
          ratio: "9:16",
          duration: "15s",
          rhythm: "Rápido",
          audio: "Sem música",
          scenes: [],
          script: "Roteiro",
        },
      },
    });
    mocks.productsRepository.findById.mockResolvedValueOnce({ id: "product_1", name: "Produto teste" });
    mocks.jobsRepository.update.mockResolvedValueOnce({ id: "job_1", status: "processing" });

    const result = await jobsService.retry("job_1", "workspace_1");

    expect(result).toMatchObject({ id: "job_1", status: "processing" });
    expect(mocks.mediaRepository.update).toHaveBeenCalledWith("asset_1", expect.objectContaining({ status: "generating" }));
    expect(mocks.enqueueVideoGeneration).toHaveBeenCalledWith(expect.objectContaining({
      job_id: "job_1",
      asset_id: "asset_1",
      product_name: "Produto teste",
    }));
  });
});
