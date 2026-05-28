import { enqueueJob } from "./queue.client.js";

export async function runJob(jobName: string, payload: Record<string, unknown>) {
  await enqueueJob(jobName, jobName, payload);
  return { jobName, payload, status: "queued" };
}
