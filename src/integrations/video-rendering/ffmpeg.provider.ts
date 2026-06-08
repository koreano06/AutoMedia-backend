import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { VideoRenderPlan, VideoRenderScene } from "../../modules/videos/video-generation.queue.js";

type RenderInput = {
  sourceUrl?: string;
  mediaUrls?: string[];
  renderPlan?: VideoRenderPlan;
  productName?: string;
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function compactText(value?: string, fallback = "") {
  return String(value || fallback)
    .replace(/\s+/g, " ")
    .trim();
}

function limitText(value: string, maxLength: number) {
  const clean = compactText(value);
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trim()}…`;
}

function wrapText(value: string, maxChars: number, maxLines: number) {
  const words = compactText(value).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }

    if (lines.length === maxLines) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  return lines.join("\n");
}

function escapeDrawText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/,/g, "\\,")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%")
    .replace(/\n/g, "\\n");
}

function concatFilePath(filePath: string) {
  return filePath.replace(/\\/g, "/").replace(/'/g, "'\\''");
}

function normalizeSceneSource(scene: VideoRenderScene, fallbackSource: string) {
  if (!scene.source || scene.source === "product_image") return fallbackSource;
  return scene.source;
}

function defaultScenes(input: RenderInput, sourceUrl: string): VideoRenderScene[] {
  const product = input.productName || "Produto em destaque";
  const duration = secondsFromDuration(input.duration);
  const sceneDuration = Math.max(3, Math.floor(duration / 4));

  return [
    {
      order: 1,
      type: "hook",
      duration_seconds: sceneDuration,
      source: sourceUrl,
      headline: `Conheça ${product}`,
      subheadline: "Criativo gerado automaticamente",
    },
    {
      order: 2,
      type: "benefit",
      duration_seconds: sceneDuration,
      source: sourceUrl,
      headline: "Benefício claro em poucos segundos",
      subheadline: "Texto direto para Reels, TikTok e Shorts",
    },
    {
      order: 3,
      type: "proof",
      duration_seconds: sceneDuration,
      source: sourceUrl,
      headline: "Visual pronto para divulgação",
      subheadline: "Movimento, ritmo e foco no produto",
    },
    {
      order: 4,
      type: "cta",
      duration_seconds: Math.max(3, duration - sceneDuration * 3),
      source: sourceUrl,
      headline: "Comente EU QUERO",
      subheadline: "Receba o link e veja os detalhes",
    },
  ];
}

async function materializeDataUrl(dataUrl: string, outputName: string) {
  const [, meta = "", payload = ""] = dataUrl.match(/^data:(.*?);base64,(.*)$/) || [];
  if (!payload) throw new AppError("Data URL inválida para renderização", 422, "INVALID_DATA_URL");

  const extension = meta.includes("png") ? "png" : meta.includes("webp") ? "webp" : "jpg";
  const inputPath = path.join(tmpdir(), `${outputName}-input.${extension}`);
  await writeFile(inputPath, Buffer.from(payload, "base64"));
  return inputPath;
}

function extensionFromContentType(contentType: string, sourceUrl: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";

  const cleanUrl = sourceUrl.split("?")[0] || "";
  const extension = cleanUrl.match(/\.([a-z0-9]{2,5})$/i)?.[1];
  return extension || "jpg";
}

async function materializeRemoteUrl(sourceUrl: string, outputName: string) {
  const response = await fetch(sourceUrl, {
    headers: {
      "User-Agent": "AutoMedia/1.0 (+https://auto-media-sooty.vercel.app)",
      Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new AppError(`Nao foi possivel baixar a midia de origem (${response.status})`, 422, "VIDEO_SOURCE_DOWNLOAD_FAILED");
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    throw new AppError(`A midia de origem nao parece ser uma imagem (${contentType || "sem content-type"})`, 422, "VIDEO_SOURCE_INVALID_TYPE");
  }

  const extension = extensionFromContentType(contentType, sourceUrl);
  const inputPath = path.join(tmpdir(), `${outputName}-remote.${extension}`);
  await writeFile(inputPath, Buffer.from(await response.arrayBuffer()));
  return inputPath;
}

async function materializeSource(source: string, outputName: string) {
  if (source.startsWith("data:")) return materializeDataUrl(source, outputName);
  if (/^https?:\/\//i.test(source)) return materializeRemoteUrl(source, outputName);
  return source;
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

function buildSceneFilter(scene: VideoRenderScene, sceneIndex: number, sceneCount: number, width: number, height: number) {
  const frames = Math.max(90, Math.round(scene.duration_seconds * 30));
  const scaledWidth = Math.ceil(width * 1.18);
  const scaledHeight = Math.ceil(height * 1.18);
  const headlineSize = clamp(Math.round(width / 17), 42, 78);
  const subheadlineSize = clamp(Math.round(width / 31), 28, 42);
  const brandSize = clamp(Math.round(width / 38), 22, 32);
  const headline = escapeDrawText(wrapText(limitText(scene.headline, 78), width >= 1600 ? 26 : 18, 3));
  const subheadline = escapeDrawText(wrapText(limitText(scene.subheadline || scene.instruction || "", 94), width >= 1600 ? 42 : 28, 2));
  const progressWidth = Math.round((width - 160) * ((sceneIndex + 1) / sceneCount));
  const safeType = escapeDrawText(scene.type.toUpperCase());
  const yBase = Math.round(height * 0.68);

  return [
    `scale=${scaledWidth}:${scaledHeight}:force_original_aspect_ratio=increase`,
    `zoompan=z='min(zoom+0.0016,1.13)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=30`,
    "format=yuv420p",
    `drawbox=x=0:y=0:w=iw:h=ih:color=black@0.12:t=fill`,
    `drawbox=x=0:y=${Math.round(height * 0.6)}:w=iw:h=${Math.round(height * 0.4)}:color=black@0.42:t=fill`,
    `drawbox=x=70:y=72:w=250:h=54:color=black@0.38:t=fill`,
    `drawtext=text='AutoMedia':fontcolor=white:fontsize=${brandSize}:x=95:y=86`,
    `drawtext=text='${safeType}':fontcolor=0xff7a2f:fontsize=${Math.max(20, brandSize - 5)}:x=w-tw-88:y=88`,
    `drawtext=text='${headline}':fontcolor=white:fontsize=${headlineSize}:line_spacing=10:x=80:y=${yBase}`,
    subheadline
      ? `drawtext=text='${subheadline}':fontcolor=white@0.86:fontsize=${subheadlineSize}:line_spacing=7:x=82:y=${yBase + Math.round(headlineSize * 2.35)}`
      : "",
    `drawbox=x=80:y=h-108:w=${width - 160}:h=10:color=white@0.16:t=fill`,
    `drawbox=x=80:y=h-108:w=${progressWidth}:h=10:color=0xff6a2a@0.95:t=fill`,
    `drawtext=text='${sceneIndex + 1}/${sceneCount}':fontcolor=white@0.72:fontsize=${Math.max(22, brandSize - 4)}:x=w-tw-82:y=h-155`,
  ]
    .filter(Boolean)
    .join(",");
}

async function renderScene(input: {
  source: string;
  scene: VideoRenderScene;
  sceneIndex: number;
  sceneCount: number;
  outputPath: string;
  width: number;
  height: number;
}) {
  const source = await materializeSource(input.source, `scene-${input.sceneIndex}-${path.basename(input.outputPath, ".mp4")}`);

  await runFfmpeg([
    "-y",
    "-loop",
    "1",
    "-i",
    source,
    "-t",
    String(input.scene.duration_seconds),
    "-vf",
    buildSceneFilter(input.scene, input.sceneIndex, input.sceneCount, input.width, input.height),
    "-r",
    "30",
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-movflags",
    "+faststart",
    input.outputPath,
  ]);
}

export const ffmpegProvider = {
  async render(input: RenderInput) {
    const primarySource = input.sourceUrl || input.mediaUrls?.[0] || input.renderPlan?.scenes?.find((scene) => scene.source && scene.source !== "product_image")?.source;

    if (!primarySource) {
      throw new AppError("Nenhuma mídia de origem disponível para renderizar o vídeo", 422, "VIDEO_SOURCE_MISSING");
    }

    const duration = secondsFromDuration(input.duration);
    const { width, height } = sizeForRatio(input.ratio);
    const safeName = input.outputName.replace(/[^a-z0-9-_]/gi, "-").toLowerCase();
    const outputDir = path.join(tmpdir(), "automedia-renders");
    const outputPath = path.join(outputDir, `${safeName}.mp4`);
    const fallbackSource = primarySource;
    const scenes = (input.renderPlan?.scenes?.length ? input.renderPlan.scenes : defaultScenes(input, fallbackSource)).map((scene, index) => ({
      ...scene,
      order: scene.order || index + 1,
      duration_seconds: Math.max(3, Number(scene.duration_seconds || Math.ceil(duration / 4))),
      source: normalizeSceneSource(scene, input.mediaUrls?.[index] || fallbackSource),
    }));

    await mkdir(outputDir, { recursive: true });

    if (scenes.length <= 1) {
      const source = await materializeSource(fallbackSource, safeName);
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
    }

    const scenePaths: string[] = [];
    for (const [index, scene] of scenes.entries()) {
      const scenePath = path.join(outputDir, `${safeName}-scene-${index + 1}.mp4`);
      scenePaths.push(scenePath);
      await renderScene({
        source: scene.source || fallbackSource,
        scene,
        sceneIndex: index,
        sceneCount: scenes.length,
        outputPath: scenePath,
        width,
        height,
      });
    }

    const concatPath = path.join(outputDir, `${safeName}-concat.txt`);
    await writeFile(concatPath, scenePaths.map((scenePath) => `file '${concatFilePath(scenePath)}'`).join("\n"));

    await runFfmpeg([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatPath,
      "-c:v",
      "copy",
      "-movflags",
      "+faststart",
      outputPath,
    ]);

    return {
      localPath: outputPath,
      mime_type: "video/mp4",
      duration: scenes.reduce((total, scene) => total + scene.duration_seconds, 0),
      width,
      height,
    };
  },
};
