const {
  beforeAll,
  afterAll,
  test,
  expect,
  jest: jestApi,
} = require("@jest/globals");
const { randomUUID } = require("node:crypto");
const { existsSync, readFileSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const process = require("node:process");
const { parseEnv } = require("node:util");
const { QueueEvents } = require("bullmq");
const {
  createMatchingQueue,
  createMatchingWorker,
  enqueueMatchingJob,
  MATCHING_JOB,
} = require("../dist/matching/matching-queue");
const { createRedisOptions } = require("../dist/matching/redis-options");

jestApi.setTimeout(15000);
const queueName = `matching-test-${randomUUID()}`;
const errors = [];
let queue, worker, events;
beforeAll(async () => {
  const envPath = resolve(
    dirname(require.resolve("../package.json")),
    "../../.env",
  );
  const local = existsSync(envPath)
    ? parseEnv(readFileSync(envPath, "utf8"))
    : {};
  const connection = createRedisOptions({ ...local, ...process.env });
  queue = createMatchingQueue(
    connection,
    (error) => errors.push(error),
    queueName,
  );
  worker = createMatchingWorker(
    connection,
    (error) => errors.push(error),
    queueName,
  );
  events = new QueueEvents(queueName, {
    connection: { ...connection, maxRetriesPerRequest: null },
  });
  events.on("error", (error) => errors.push(error));
  await Promise.all([
    queue.waitUntilReady(),
    worker.waitUntilReady(),
    events.waitUntilReady(),
  ]);
});
afterAll(async () => {
  if (worker) await worker.close();
  if (events) await events.close();
  if (queue) {
    // This random queue belongs only to this test run. Never flush shared Redis.
    await queue.obliterate({ force: true });
    await queue.close();
  }
});

function example() {
  return {
    candidates: [
      {
        trip: {
          id: "example-trip",
          capacityKg: 1000,
          departureAtMs: 0,
          latestArrivalAtMs: 10000,
          reliability: 1,
        },
        load: {
          id: "example-load",
          weightKg: 100,
          pickupWindowStartMs: 0,
          pickupWindowEndMs: 5000,
        },
        estimate: {
          pickupAtMs: 1000,
          tripEndAtMs: 2000,
          detourKm: 1,
          delayMinutes: 0,
          priceGapUzs: 0,
        },
      },
    ],
    limits: { maxDetourKm: 10 },
    weights: { detour: 1, delay: 0, priceGap: 0, reliability: 0 },
  };
}

test("processes a real Redis job and persists its proposal result", async () => {
  const job = await enqueueMatchingJob(queue, example());
  const result = await job.waitUntilFinished(events, 5000);
  expect(result).toEqual({
    proposals: [{ tripId: "example-trip", loadId: "example-load" }],
  });
  const stored = await queue.getJob(job.id);
  expect(await stored.getState()).toBe("completed");
  expect(stored.returnvalue).toEqual(result);
  expect(errors).toEqual([]);
});

test.each([
  [MATCHING_JOB, { candidates: null }],
  ["unsupported-job", {}],
])("rejects invalid job %s without retrying", async (name, data) => {
  const job = await queue.add(name, data, { attempts: 3 });
  await expect(job.waitUntilFinished(events, 5000)).rejects.toThrow();
  const stored = await queue.getJob(job.id);
  expect(await stored.getState()).toBe("failed");
  expect(stored.attemptsMade).toBe(1);
});
