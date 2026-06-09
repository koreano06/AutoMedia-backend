import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {
    NODE_ENV: "test",
    OPENAI_API_KEY: "test-key",
    OPENAI_IMAGE_FALLBACK_ENABLED: "false",
    OPENAI_IMAGE_MODEL: "gpt-image-1",
    SOCIAL_INTEGRATIONS_MODE: "mock",
    STORAGE_DRIVER: "local",
    SUPABASE_SERVICE_ROLE_KEY: "",
    SUPABASE_STORAGE_BUCKET: "",
    SUPABASE_URL: "",
  },
  queueConnection: {
    ping: vi.fn(),
  },
  prisma: {
    job: {
      count: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    platformAccount: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../../config/env.js", () => ({ env: mocks.env }));
vi.mock("../../database/prisma.js", () => ({ prisma: mocks.prisma }));
vi.mock("../../queue/queue.client.js", () => ({ getQueueConnection: () => mocks.queueConnection }));

const { diagnosticsService } = await import("./diagnostics.service.js");

describe("diagnosticsService.runChecks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queueConnection.ping.mockResolvedValue("PONG");
    mocks.prisma.job.create.mockResolvedValue({ id: "job_diag_1" });
    mocks.prisma.job.count.mockResolvedValue(0);
    mocks.prisma.job.findMany.mockResolvedValue([]);
    mocks.prisma.job.update.mockResolvedValue({ id: "job_diag_1" });
    mocks.prisma.job.delete.mockResolvedValue({ id: "job_diag_1" });
    mocks.prisma.platformAccount.findFirst.mockResolvedValue({
      platform: "instagram",
      status: "connected",
    });
  });

  it("runs safe backend checks with workspace context", async () => {
    const result = await diagnosticsService.runChecks({
      checks: ["auth", "database_write", "queue", "mock_publish", "permissions"],
    }, {
      id: "user_1",
      role: "admin",
      workspace_id: "workspace_1",
    });

    expect(result.status).toBe("ok");
    expect(result.results.map((item) => item.id)).toEqual(["auth", "database_write", "queue", "mock_publish", "permissions"]);
    expect(mocks.prisma.job.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "queued",
        type: "diagnostic_check",
        workspaceId: "workspace_1",
      }),
    });
    expect(mocks.prisma.job.delete).toHaveBeenCalledWith({ where: { id: "job_diag_1" } });
  });

  it("returns warnings when current user does not have admin permissions", async () => {
    const result = await diagnosticsService.runChecks({ checks: ["permissions"] }, {
      id: "user_2",
      role: "operator",
      workspace_id: "workspace_1",
    });

    expect(result.status).toBe("warning");
    expect(result.results[0]).toMatchObject({
      id: "permissions",
      status: "warning",
    });
  });

  it("warns when the video pipeline has stale jobs", async () => {
    mocks.prisma.job.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    mocks.prisma.job.findMany.mockResolvedValueOnce([{
      id: "job_stale_1",
      status: "rendering",
      title: "Render preso",
      updatedAt: new Date(Date.now() - 20 * 60 * 1000),
    }]);

    const result = await diagnosticsService.runChecks({ checks: ["video_pipeline"] }, {
      id: "user_1",
      role: "admin",
      workspace_id: "workspace_1",
    });

    expect(result.status).toBe("warning");
    expect(result.results[0]).toMatchObject({
      id: "video_pipeline",
      status: "warning",
      metadata: expect.objectContaining({
        active_count: 2,
        stale_count: 1,
        stale_job_id: "job_stale_1",
      }),
    });
  });
});
