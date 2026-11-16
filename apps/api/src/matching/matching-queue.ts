import {
  Queue,
  RedisConnection,
  createIORedisClient,
  UnrecoverableError,
  Worker,
} from "bullmq";
import { Redis } from "ioredis";
import type { createRedisOptions } from "./redis-options";
import { parseMatchingJob, processMatchingJob } from "./matching-job";
import type { MatchingJobData, MatchingJobResult } from "./matching-job";

type RedisSettings = ReturnType<typeof createRedisOptions>;

// Resolve the driver from this workspace; BullMQ may be hoisted elsewhere.
RedisConnection.clientFactory = (options) =>
  createIORedisClient(new Redis(options));

export const MATCHING_QUEUE = "freight-matching-v1";
export const MATCHING_JOB = "assign-snapshot-v1";

export function createMatchingQueue(
  connection: RedisSettings,
  onError: (error: Error) => void,
  name = MATCHING_QUEUE,
) {
  const queue = new Queue<
    MatchingJobData,
    MatchingJobResult,
    typeof MATCHING_JOB
  >(name, {
    connection: {
      ...connection,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    },
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { age: 86400, count: 100 },
      removeOnFail: { age: 604800, count: 100 },
    },
  });
  queue.on("error", onError);
  return queue;
}

export function createMatchingWorker(
  connection: RedisSettings,
  onError: (error: Error) => void,
  name = MATCHING_QUEUE,
) {
  const worker = new Worker<unknown, MatchingJobResult>(
    name,
    async (job) => {
      if (job.name !== MATCHING_JOB)
        throw new UnrecoverableError("Unknown matching job");
      try {
        return processMatchingJob(job.data);
      } catch (error) {
        throw new UnrecoverableError(
          error instanceof Error ? error.message : "Invalid matching job",
        );
      }
    },
    {
      connection: { ...connection, maxRetriesPerRequest: null },
      concurrency: 1,
    },
  );
  worker.on("error", onError);
  return worker;
}

export async function enqueueMatchingJob(
  queue: ReturnType<typeof createMatchingQueue>,
  value: unknown,
) {
  const data = parseMatchingJob(value);
  return queue.add(MATCHING_JOB, data);
}
