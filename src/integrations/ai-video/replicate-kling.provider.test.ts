import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {
    REPLICATE_API_TOKEN: "replicate-test-token",
    REPLICATE_KLING_MODEL: "kwaivgi/kling-v2.1",
    REPLICATE_KLING_MODE: "standard",
    REPLICATE_KLING_NEGATIVE_PROMPT: "low quality",
    REPLICATE_POLL_INTERVAL_MS: 1,
    REPLICATE_TIMEOUT_MS: 1000,
  },
}));

vi.mock("../../config/env.js", () => ({ env: mocks.env }));

const { replicateKlingProvider } = await import("./replicate-kling.provider.js");

describe("replicateKlingProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.env.REPLICATE_API_TOKEN = "replicate-test-token";
  });

  it("creates a Kling prediction and returns the generated video URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "prediction_1",
        status: "succeeded",
        output: "https://replicate.delivery/generated-video.mp4",
        metrics: { predict_time: 12 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await replicateKlingProvider.generate({
      assetId: "asset_1",
      jobId: "job_1",
      productName: "Panela elétrica",
      startImageUrl: "https://cdn.example.com/panela.jpg",
      prompt: "Mostre unboxing e demonstração do produto.",
      duration: "10s",
    });

    expect(result).toMatchObject({
      provider: "replicate_kling",
      model: "kwaivgi/kling-v2.1",
      prediction_id: "prediction_1",
      output_url: "https://replicate.delivery/generated-video.mp4",
      duration_seconds: 10,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.replicate.com/v1/models/kwaivgi/kling-v2.1/predictions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer replicate-test-token",
        }),
      }),
    );
  });

  it("blocks private start images before calling Replicate", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(replicateKlingProvider.generate({
      assetId: "asset_1",
      jobId: "job_1",
      startImageUrl: "http://192.168.1.6:9000/automedia-media/produto.jpg",
      prompt: "Gerar vídeo.",
    })).rejects.toMatchObject({
      code: "AI_VIDEO_START_IMAGE_NOT_PUBLIC",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces Replicate API failures with a stable error code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: "Invalid start_image" }),
    }));

    await expect(replicateKlingProvider.generate({
      assetId: "asset_1",
      jobId: "job_1",
      startImageUrl: "https://cdn.example.com/panela.jpg",
      prompt: "Gerar vídeo.",
    })).rejects.toMatchObject({
      code: "REPLICATE_CREATE_FAILED",
      statusCode: 422,
    });
  });
});
