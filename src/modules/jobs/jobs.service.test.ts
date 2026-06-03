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
}));

vi.mock("./jobs.repository.js", () => ({ jobsRepository: mocks.jobsRepository }));

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
});
