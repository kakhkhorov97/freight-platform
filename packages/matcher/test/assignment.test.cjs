const { expect, test } = require("@jest/globals");
const {
  firstComeFirstServed,
  greedyNearest,
  batchAssign,
  calculatePairCost,
} = require("../dist");
const limits = { maxDetourKm: 1000 };
const weights = { detour: 1, delay: 0, priceGap: 0, reliability: 0 };

function pair(tripId, loadId, cost, distance = cost) {
  return Object.freeze({
    trip: Object.freeze({
      id: tripId,
      capacityKg: 1000,
      departureAtMs: 1000,
      latestArrivalAtMs: 5000,
      reliability: 1,
    }),
    load: Object.freeze({
      id: loadId,
      weightKg: 500,
      pickupWindowStartMs: 2000,
      pickupWindowEndMs: 4000,
    }),
    estimate: Object.freeze({
      pickupAtMs: 3000,
      tripEndAtMs: 5000,
      detourKm: cost,
      delayMinutes: 0,
      priceGapUzs: 0,
      pickupDistanceKm: distance,
    }),
  });
}

function ids(matches) {
  return matches.map(({ trip, load }) => [trip.id, load.id]);
}

for (const algorithm of [firstComeFirstServed, greedyNearest, batchAssign]) {
  test(
    algorithm.name + " handles empty, infeasible, and conflicting candidates",
    () => {
      expect(algorithm([], limits, weights)).toEqual([]);
      const unavailable = {
        ...pair("a", "x", 1),
        load: { ...pair("a", "x", 1).load, weightKg: 1001 },
      };
      expect(algorithm([unavailable], limits, weights)).toEqual([]);
      const result = algorithm(
        [pair("a", "x", 1), pair("a", "y", 2), pair("b", "y", 3)],
        limits,
        weights,
      );
      expect(new Set(result.map((p) => p.trip.id)).size).toBe(result.length);
      expect(new Set(result.map((p) => p.load.id)).size).toBe(result.length);
      expect(() =>
        algorithm([pair("a", "x", 1), pair("a", "x", 2)], limits, weights),
      ).toThrow(/Duplicate/);
      const inconsistent = {
        ...pair("a", "y", 2),
        trip: { ...pair("a", "y", 2).trip, capacityKg: 900 },
      };
      expect(() =>
        algorithm([pair("a", "x", 1), inconsistent], limits, weights),
      ).toThrow(/Repeated IDs/);
    },
  );
}

test("FCFS follows caller order and greedy nearest uses pickup distance", () => {
  const pairs = Object.freeze([pair("a", "x", 1, 10), pair("b", "x", 9, 1)]);
  expect(ids(firstComeFirstServed(pairs, limits))).toEqual([["a", "x"]]);
  expect(ids(greedyNearest(pairs, limits))).toEqual([["b", "x"]]);
  expect(pairs[0].trip.id).toBe("a");
});

test("nearest ties preserve input order and require real pickup estimates", () => {
  expect(
    ids(greedyNearest([pair("b", "x", 2, 1), pair("a", "x", 1, 1)], limits)),
  ).toEqual([["b", "x"]]);
  const candidate = pair("a", "x", 1);
  const estimate = { ...candidate.estimate };
  delete estimate.pickupDistanceKm;
  expect(() => greedyNearest([{ ...candidate, estimate }], limits)).toThrow(
    /pickupDistanceKm/,
  );
});

test("batch reassigns an earlier choice to maximize matched loads", () => {
  const pairs = Object.freeze([
    pair("a", "x", 1),
    pair("a", "y", 2),
    pair("b", "x", 1),
  ]);
  expect(firstComeFirstServed(pairs, limits)).toHaveLength(1);
  expect(greedyNearest(pairs, limits)).toHaveLength(1);
  expect(ids(batchAssign(pairs, limits, weights))).toEqual([
    ["a", "y"],
    ["b", "x"],
  ]);
});

test("among maximum-cardinality assignments batch minimizes total cost", () => {
  const pairs = [
    pair("a", "x", 1),
    pair("a", "y", 2),
    pair("b", "x", 2),
    pair("b", "y", 100),
  ];
  const result = batchAssign(pairs, limits, weights);
  expect(ids(result)).toEqual([
    ["a", "y"],
    ["b", "x"],
  ]);
  expect(
    result.reduce((sum, p) => sum + calculatePairCost(p, weights), 0),
  ).toBe(4);
});

test("zero costs, tied choices, and rectangular graphs are deterministic", () => {
  const pairs = [
    pair("a", "x", 0),
    pair("a", "y", 0),
    pair("b", "y", 0),
    pair("c", "y", 0),
  ];
  expect(ids(batchAssign(pairs, limits, weights))).toEqual([
    ["a", "x"],
    ["b", "y"],
  ]);
});

test("batch validates weights even without candidates and guards overflow", () => {
  expect(() => batchAssign([], limits, { ...weights, delay: NaN })).toThrow(
    /delay weight/,
  );
  expect(() =>
    batchAssign([pair("a", "x", 1)], limits, {
      ...weights,
      detour: Number.MAX_VALUE,
    }),
  ).toThrow(/magnitude/);
});

function exhaustiveOptimum(pairs) {
  let best = { count: 0, cost: 0 };
  function visit(trip, usedLoads, count, cost) {
    if (trip === 3) {
      if (count > best.count || (count === best.count && cost < best.cost))
        best = { count, cost };
      return;
    }
    visit(trip + 1, usedLoads, count, cost);
    for (const candidate of pairs.filter((p) => p.trip.id === String(trip))) {
      if (usedLoads.has(candidate.load.id)) continue;
      visit(
        trip + 1,
        new Set([...usedLoads, candidate.load.id]),
        count + 1,
        cost + candidate.estimate.detourKm,
      );
    }
  }
  visit(0, new Set(), 0, 0);
  return best;
}

test.each([4, 10])(
  "batch agrees with exhaustive search on 512 graphs with cost denominator %i",
  (denominator) => {
    for (let mask = 0; mask < 512; mask += 1) {
      const pairs = [];
      for (let edge = 0; edge < 9; edge += 1) {
        if ((mask & (1 << edge)) !== 0) {
          pairs.push(
            pair(
              String(Math.floor(edge / 3)),
              String(edge % 3),
              ((mask + edge * 7) % 17) / denominator,
            ),
          );
        }
      }
      const selected = batchAssign(pairs, limits, weights);
      const expected = exhaustiveOptimum(pairs);
      expect(selected).toHaveLength(expected.count);
      expect(
        selected.reduce((sum, p) => sum + p.estimate.detourKm, 0),
      ).toBeCloseTo(expected.cost, 10);
    }
  },
);
