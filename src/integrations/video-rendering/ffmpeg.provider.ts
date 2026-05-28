import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";

type RenderInput = {
  sourceUrl?: string;
  outputName: string;
  duration?: string | number;
  ratio?: string;
};

function secondsFromDuration(duration?: string | number) {
  if (typeof duration === "number") return Math.max(3, duration);
  const match = String(duration || "30s").match(/\d+/);
  return Math.max(3, Number(match?.[0] || 30));
}

function sizeForRatio(ratio?: string) {
  if (ratio === "16:9") return { width: 1920, height: 1080 };
  if (ratio === "1:1") return { width: 1080, height: 1080 };
  return { width: 1080, height: 1920 };
}

async function materializeDataUrl(dataUrl: string, outputName: string) {
  const [, meta = "", payload = ""] = dataUrl.match(/^data:(.*?);base64,(.*)$/) || [];
  if (!payload) throw new AppError("Data URL inválida para renderização", 422, "INVALID_DATA_URL");

  const extension = meta.includes("png") ? "png" : meta.includes("webp") ? "webp" : "jpg";
  const inputPath = path.join(tmpdir(), `${outputName}-input.${extension}`);
  await writeFile(inputPath, Buffer.from(payload, "base64"));
  return inputPath;
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(env.FFMPEG_PATH, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new AppError(stderr || "FFmpeg falhou ao renderizar o vídeo", 500, "FFMPEG_RENDER_ERROR"));
    });
  });
}

export const ffmpegProvider = {
  async render(input: RenderInput) {
    if (!input.sourceUrl) {
      throw new AppError("Nenhuma mídia de origem disponível para renderizar o vídeo", 422, "VIDEO_SOURCE_MISSING");
    }

    const duration = secondsFromDuration(input.duration);
    const { width, height } = sizeForRatio(input.ratio);
    const safeName = input.outputName.replace(/[^a-z0-9-_]/gi, "-").toLowerCase();
    const outputDir = path.join(tmpdir(), "automedia-renders");
    const outputPath = path.join(outputDir, `${safeName}.mp4`);
    const source = input.sourceUrl.startsWith("data:") ? await materializeDataUrl(input.sourceUrl, safeName) : input.sourceUrl;

    await mkdir(outputDir, { recursive: true });
    await runFfmpeg([
      "-y",
      "-loop",
      "1",
      "-i",
      source,
      "-t",
      String(duration),
      "-vf",
      `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},format=yuv420p`,
      "-r",
      "30",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-movflags",
      "+faststart",
      outputPath,
    ]);

    return {
      localPath: outputPath,
      mime_type: "video/mp4",
      duration,
      width,
      height,
    };
  },
};
