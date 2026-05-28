import "dotenv/config";
import { startVideoGenerationWorker } from "./video-generation.worker.js";

const worker = startVideoGenerationWorker();

console.log("Video generation worker started.");

async function shutdown() {
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
