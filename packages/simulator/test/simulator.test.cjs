const { test, expect } = require("@jest/globals");
const { spawnSync } = require("node:child_process");
const { dirname, resolve } = require("node:path");
const process = require("node:process");
const { generateSyntheticDemand, runSimulation } = require("../dist");
const limits = { maxDetourKm: 20 };
const weights = { detour: 1, delay: 1, priceGap: 0.001, reliability: 10 };

test("demand is repeatable and every scenario is explicitly synthetic", () => {
  const scenario = generateSyntheticDemand({
    seed: 42,
    tripCount: 6,
    loadCount: 8,
  });
  expect(scenario).toEqual(
    generateSyntheticDemand({ seed: 42, tripCount: 6, loadCount: 8 }),
  );
  expect(scenario).not.toEqual(
    generateSyntheticDemand({ seed: 43, tripCount: 6, loadCount: 8 }),
  );
  expect(scenario.source).toBe("synthetic");
  expect(scenario.model.kind).toBe("illustrative-line-corridor");
  expect(scenario.candidates).toHaveLength(48);
});

test("adoption uses nested samples of the same population and demand", () => {
  const low = generateSyntheticDemand({
    seed: 4,
    tripCount: 10,
    loadCount: 5,
    adoptionRate: 0.3,
  });
  const high = generateSyntheticDemand({
    seed: 4,
    tripCount: 10,
    loadCount: 5,
    adoptionRate: 0.6,
  });
  expect(low.trips).toEqual(high.trips);
  expect(low.loads).toEqual(high.loads);
  expect(low.participatingTripIds).toHaveLength(3);
  expect(high.participatingTripIds).toHaveLength(6);
  for (const id of low.participatingTripIds)
    expect(high.participatingTripIds).toContain(id);
  for (const pair of low.candidates)
    expect(low.participatingTripIds).toContain(pair.trip.id);
});

test("route estimates conserve distance and candidate order represents availability", () => {
  const scenario = generateSyntheticDemand({
    seed: 0,
    tripCount: 5,
    loadCount: 7,
  });
  let lastStart = -Infinity;
  for (const pair of scenario.candidates) {
    expect(pair.load.pickupWindowStartMs).toBeGreaterThanOrEqual(lastStart);
    lastStart = pair.load.pickupWindowStartMs;
    expect(pair.estimate.loadedDistanceKm).toBeGreaterThanOrEqual(0);
    expect(pair.estimate.loadedDistanceKm).toBeLessThanOrEqual(
      pair.trip.baselineDistanceKm + pair.estimate.detourKm,
    );
    expect(pair.estimate.tripEndAtMs).toBeGreaterThanOrEqual(
      pair.estimate.pickupAtMs,
    );
    expect(Number.isSafeInteger(pair.estimate.pickupAtMs)).toBe(true);
  }
});

test("zero adoption keeps nonparticipating fleet distance in the report", () => {
  const scenario = generateSyntheticDemand({
    tripCount: 5,
    loadCount: 8,
    adoptionRate: 0,
  });
  const report = runSimulation(scenario, limits, weights);
  for (const result of report.results) {
    expect(result.matches).toEqual([]);
    expect(result.metrics).toMatchObject({
      emptyKmShare: 1,
      totalDistanceKm: 500,
      matchedLoadRate: 0,
    });
  }
});

test.each([0, 1, 42, 999])(
  "all strategies use consistent inputs for seed %i",
  (seed) => {
    const scenario = generateSyntheticDemand({
      seed,
      tripCount: 12,
      loadCount: 16,
    });
    const report = runSimulation(scenario, limits, weights);
    expect(report).toEqual(runSimulation(scenario, limits, weights));
    expect(report.results.map((result) => result.strategy)).toEqual([
      "fcfs",
      "greedy-nearest",
      "batch",
    ]);
    const batch = report.results[2];
    for (const result of report.results) {
      expect(batch.matches.length).toBeGreaterThanOrEqual(
        result.matches.length,
      );
      expect(result.metrics.emptyKmShare).toBeGreaterThanOrEqual(0);
      expect(result.metrics.emptyKmShare).toBeLessThanOrEqual(1);
      expect(result.metrics.matchedLoadRate).toBe(
        result.matches.length / scenario.loads.length,
      );
    }
  },
);

test("invalid generation settings and invalid scenario membership are rejected", () => {
  for (const options of [
    { seed: -1 },
    { tripCount: 101 },
    { loadCount: 1.5 },
    { adoptionRate: 1.1 },
    { speedKph: 0 },
    { startAtMs: Number.MAX_SAFE_INTEGER },
  ]) {
    expect(() => generateSyntheticDemand(options)).toThrow(RangeError);
  }
  const scenario = generateSyntheticDemand({ tripCount: 1, loadCount: 1 });
  expect(() =>
    runSimulation({ ...scenario, participatingTripIds: [] }, limits, weights),
  ).toThrow(/Scenario/);
  const empty = runSimulation(
    generateSyntheticDemand({ tripCount: 0, loadCount: 0 }),
    limits,
    weights,
  );
  expect(
    empty.results.every((result) => result.metrics.emptyKmShare === 0),
  ).toBe(true);
});

test("the CLI prints reproducible JSON and rejects invalid flags", () => {
  const cli = resolve(
    dirname(require.resolve("../package.json")),
    "dist/cli.js",
  );
  const result = spawnSync(
    process.execPath,
    [cli, "--seed", "42", "--trips", "6", "--loads", "8", "--adoption", "0.5"],
    { encoding: "utf8", timeout: 10000 },
  );
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  expect(JSON.parse(result.stdout)).toEqual(
    runSimulation(
      generateSyntheticDemand({
        seed: 42,
        tripCount: 6,
        loadCount: 8,
        adoptionRate: 0.5,
      }),
      limits,
      weights,
    ),
  );
  for (const args of [
    ["--unknown"],
    ["--adoption", "2"],
    ["--seed", ""],
    ["--detour", "-1"],
  ]) {
    const rejected = spawnSync(process.execPath, [cli, ...args], {
      encoding: "utf8",
      timeout: 10000,
    });
    expect(rejected.status).toBe(1);
    expect(rejected.stdout).toBe("");
    expect(rejected.stderr.length).toBeGreaterThan(0);
  }
});
