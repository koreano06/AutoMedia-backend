import { Queue, type JobsOptions } from "bullmq";
import { Redis } from "ioredis";
import { queueConfig, requireQueueRedisUrl } from "../config/queue.js";

let connection: InstanceType<typeof Redis> | undefined;
const queues = new Map<string, Queue>();

export function getQueueConnection(): InstanceType<typeof Redis> {
  if (!connection) {
    connection = new Redis(requireQueueRedisUrl(), {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectionName: "automedia-bullmq",
      ...(queueConfig.isTls ? { tls: {} } : {}),
    });
  }

  return connection;
}

export function getQueue(name: string) {
  if (!queues.has(name)) {
    queues.set(name, new Queue(name, { connection: getQueueConnection() }));
  }

  return queues.get(name)!;
}

export async function enqueueJob<T extends Record<string, unknown>>(queueName: string, jobName: string, payload: T, options?: JobsOptions) {
  const queue = getQueue(queueName);
  return queue.add(jobName, payload, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 250,
    ...options,
  });
}
