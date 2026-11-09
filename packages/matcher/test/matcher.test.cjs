const { expect, test } = require("@jest/globals");
const {
  calculatePairCost,
  filterFeasiblePairs,
  isFeasiblePair,
} = require("../dist");

const trip = Object.freeze({
  id: "trip",
  capacityKg: 500,
  departureAtMs: 1000,
  latestArrivalAtMs: 5000,
  reliability: 0.75,
});
const load = Object.freeze({
  id: "load",
  weightKg: 500,
  pickupWindowStartMs: 2000,
  pickupWindowEndMs: 3000,
});
const estimate = Object.freeze({
  pickupAtMs: 3000,
  tripEndAtMs: 5000,
  detourKm: 10,
  delayMinutes: 4,
  priceGapUzs: 1000,
});
const pair = Object.freeze({ trip, load, estimate });
const limits = { maxDetourKm: 10 };

test("accepts equality at capacity, detour, pickup and arrival limits", () => {
  expect(isFeasiblePair(pair, limits)).toBe(true);
});

test.each([
  ["excess load weight", { load: { ...load, weightKg: 501 } }],
  ["excess detour", { estimate: { ...estimate, detourKm: 10.01 } }],
  ["pickup too early", { estimate: { ...estimate, pickupAtMs: 1999 } }],
  ["pickup too late", { estimate: { ...estimate, pickupAtMs: 3001 } }],
  ["pickup before truck departure", { trip: { ...trip, departureAtMs: 3001 } }],
  [
    "nonoverlapping windows",
    { load: { ...load, pickupWindowStartMs: 6000, pickupWindowEndMs: 7000 } },
  ],
  ["late final arrival", { estimate: { ...estimate, tripEndAtMs: 5001 } }],
])("rejects %s", (_label, overrides) => {
  expect(isFeasiblePair({ ...pair, ...overrides }, limits)).toBe(false);
});

test("filters in input order and leaves its input intact", () => {
  const rejected = { ...pair, estimate: { ...estimate, detourKm: 11 } };
  const later = { ...pair, load: { ...load, id: "later" } };
  const candidates = Object.freeze([pair, rejected, later]);
  expect(filterFeasiblePairs(candidates, limits)).toEqual([pair, later]);
  expect(candidates).toHaveLength(3);
  expect(filterFeasiblePairs([], limits)).toEqual([]);
});

test("rejects malformed windows, route estimates and limits", () => {
  expect(() =>
    isFeasiblePair(
      { ...pair, load: { ...load, pickupWindowEndMs: 1000 } },
      limits,
    ),
  ).toThrow(/Pickup window/);
  expect(() =>
    isFeasiblePair(
      { ...pair, estimate: { ...estimate, tripEndAtMs: 2999 } },
      limits,
    ),
  ).toThrow(/Route estimate/);
  expect(() =>
    isFeasiblePair({ ...pair, trip: { ...trip, capacityKg: 0 } }, limits),
  ).toThrow(/capacityKg/);
  expect(() => filterFeasiblePairs([], { maxDetourKm: -1 })).toThrow(
    /maxDetourKm/,
  );
});

const weights = { detour: 2, delay: 3, priceGap: 0.01, reliability: 40 };

test("computes a weighted sum in the documented units", () => {
  expect(calculatePairCost(pair, weights)).toBe(52);
  expect(
    calculatePairCost({ ...pair, trip: { ...trip, reliability: 1 } }, weights),
  ).toBe(42);
  expect(
    calculatePairCost(pair, {
      detour: 0,
      delay: 0,
      priceGap: 0,
      reliability: 0,
    }),
  ).toBe(0);
});

test("rejects invalid cost inputs and numeric overflow", () => {
  expect(() => calculatePairCost(pair, { ...weights, delay: -1 })).toThrow(
    /delay weight/,
  );
  expect(() =>
    calculatePairCost(
      { ...pair, trip: { ...trip, reliability: 1.1 } },
      weights,
    ),
  ).toThrow(/reliability/);
  expect(() =>
    calculatePairCost(
      { ...pair, estimate: { ...estimate, priceGapUzs: Infinity } },
      weights,
    ),
  ).toThrow(/priceGapUzs/);
  expect(() =>
    calculatePairCost(pair, { ...weights, detour: Number.MAX_VALUE }),
  ).toThrow(/numeric range/);
});
