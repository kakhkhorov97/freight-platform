const { test, expect } = require("@jest/globals");
const { calculateMatchMetrics } = require("../dist");
const trip = {
  id: "a",
  baselineDistanceKm: 100,
  capacityKg: 1000,
  departureAtMs: 0,
  latestArrivalAtMs: 7_200_000,
  reliability: 1,
};
const other = { ...trip, id: "b", baselineDistanceKm: 200 };
const load = {
  id: "x",
  weightKg: 500,
  pickupWindowStartMs: 600_000,
  pickupWindowEndMs: 3_600_000,
};
const pair = {
  trip,
  load,
  estimate: {
    pickupAtMs: 900_000,
    tripEndAtMs: 3_600_000,
    detourKm: 20,
    loadedDistanceKm: 80,
    delayMinutes: 0,
    priceGapUzs: 0,
  },
};

test("metrics include unmatched trips and use load availability for waiting", () => {
  expect(
    calculateMatchMetrics([trip, other], [load, { ...load, id: "y" }], [pair]),
  ).toEqual({
    matchedLoadCount: 1,
    matchedLoadRate: 0.5,
    totalDistanceKm: 320,
    emptyDistanceKm: 240,
    emptyKmShare: 0.75,
    averageDetourKm: 20,
    averageWaitMinutes: 5,
  });
});

test("empty assignments count the whole fleet's distance as empty", () => {
  expect(calculateMatchMetrics([trip, other], [load], [])).toMatchObject({
    matchedLoadCount: 0,
    matchedLoadRate: 0,
    totalDistanceKm: 300,
    emptyDistanceKm: 300,
    emptyKmShare: 1,
    averageDetourKm: 0,
    averageWaitMinutes: 0,
  });
  expect(calculateMatchMetrics([], [], [])).toEqual({
    matchedLoadCount: 0,
    matchedLoadRate: 0,
    totalDistanceKm: 0,
    emptyDistanceKm: 0,
    emptyKmShare: 0,
    averageDetourKm: 0,
    averageWaitMinutes: 0,
  });
});

test("metrics reject missing distances, contradictory assignments, and invalid routes", () => {
  expect(() =>
    calculateMatchMetrics(
      [{ ...trip, baselineDistanceKm: undefined }],
      [load],
      [],
    ),
  ).toThrow(/baselineDistanceKm/);
  expect(() =>
    calculateMatchMetrics(
      [trip],
      [load],
      [
        {
          ...pair,
          estimate: { ...pair.estimate, loadedDistanceKm: undefined },
        },
      ],
    ),
  ).toThrow(/loadedDistanceKm/);
  expect(() =>
    calculateMatchMetrics(
      [trip],
      [load],
      [{ ...pair, estimate: { ...pair.estimate, loadedDistanceKm: 121 } }],
    ),
  ).toThrow(/exceeds/);
  expect(() => calculateMatchMetrics([trip], [load], [pair, pair])).toThrow(
    /one-to-one/,
  );
  expect(() => calculateMatchMetrics([trip], [], [pair])).toThrow(
    /supplied fleet/,
  );
  expect(() => calculateMatchMetrics([trip, trip], [], [])).toThrow(/unique/);
  expect(() =>
    calculateMatchMetrics(
      [trip],
      [load],
      [{ ...pair, estimate: { ...pair.estimate, pickupAtMs: 0 } }],
    ),
  ).toThrow(/feasible/);
});

test("metrics reject overflowing totals", () => {
  expect(() =>
    calculateMatchMetrics(
      [
        { ...trip, baselineDistanceKm: Number.MAX_VALUE },
        { ...other, baselineDistanceKm: Number.MAX_VALUE },
      ],
      [],
      [],
    ),
  ).toThrow(/Metric totals/);
});
