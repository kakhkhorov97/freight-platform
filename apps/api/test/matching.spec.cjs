const { test, expect } = require("@jest/globals");
const {
  processMatchingJob,
  parseMatchingJob,
} = require("../dist/matching/matching-job");
const { createRedisOptions } = require("../dist/matching/redis-options");

function data() {
  // Hand-made example where selecting the cheapest pair first is worse overall.
  const candidates = [
    ["a", "x", 1],
    ["a", "y", 2],
    ["b", "x", 2],
    ["b", "y", 100],
  ].map(([tripId, loadId, detourKm]) => ({
    trip: {
      id: tripId,
      capacityKg: 1000,
      departureAtMs: 0,
      latestArrivalAtMs: 10000,
      reliability: 1,
    },
    load: {
      id: loadId,
      weightKg: 100,
      pickupWindowStartMs: 0,
      pickupWindowEndMs: 5000,
    },
    estimate: {
      pickupAtMs: 1000,
      tripEndAtMs: 2000,
      detourKm,
      delayMinutes: 0,
      priceGapUzs: 0,
    },
  }));
  return {
    candidates,
    limits: { maxDetourKm: 100 },
    weights: { detour: 1, delay: 0, priceGap: 0, reliability: 0 },
  };
}

test("job processor uses shared batch assignment and returns proposals", () => {
  const job = data();
  expect(processMatchingJob(job).proposals).toEqual(
    expect.arrayContaining([
      { tripId: "a", loadId: "y" },
      { tripId: "b", loadId: "x" },
    ]),
  );
  expect(processMatchingJob(job).proposals).toHaveLength(2);
  expect(processMatchingJob({ ...job, candidates: [] })).toEqual({
    proposals: [],
  });
});

test.each([null, [], {}, { candidates: "invalid" }])(
  "rejects malformed external job data %j",
  (value) => {
    expect(() => parseMatchingJob(value)).toThrow();
  },
);

test("validates IDs, numeric fields, and semantic input before processing", () => {
  const invalid = [
    (d) => {
      d.candidates[0].trip.id = 1;
    },
    (d) => {
      d.candidates[0].estimate.pickupAtMs = "1000";
    },
    (d) => {
      d.candidates[0].trip.capacityKg = 0;
    },
    (d) => {
      d.candidates[0].trip.reliability = 2;
    },
    (d) => {
      d.candidates[0].load = null;
    },
    (d) => {
      d.weights.detour = -1;
    },
    (d) => {
      d.candidates[0].estimate.loadedDistanceKm = NaN;
    },
    (d) => {
      d.candidates.push(d.candidates[0]);
    },
  ];
  for (const mutate of invalid) {
    const job = data();
    mutate(job);
    expect(() => processMatchingJob(job)).toThrow();
  }
});

test("bounds payload size and number of trips", () => {
  const job = data();
  expect(() =>
    parseMatchingJob({
      ...job,
      candidates: Array(1001).fill(job.candidates[0]),
    }),
  ).toThrow("1000");
  const candidates = Array.from({ length: 51 }, (_, i) => ({
    ...job.candidates[0],
    trip: { ...job.candidates[0].trip, id: String(i) },
  }));
  expect(() => parseMatchingJob({ ...job, candidates })).toThrow("50 trips");
});

test("Redis settings default locally and reject malformed values", () => {
  expect(createRedisOptions({})).toMatchObject({
    host: "127.0.0.1",
    port: 6379,
  });
  expect(
    createRedisOptions({ REDIS_HOST: "::1", REDIS_PORT: "6380" }).port,
  ).toBe(6380);
  for (const settings of [
    { REDIS_HOST: "http://localhost" },
    { REDIS_PORT: "0" },
    { REDIS_PORT: "65536" },
    { REDIS_PORT: "6e3" },
    { REDIS_PORT: "6379 " },
  ]) {
    expect(() => createRedisOptions(settings)).toThrow();
  }
});
