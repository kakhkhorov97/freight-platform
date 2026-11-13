const { test, expect } = require("@jest/globals");
const { spawnSync } = require("node:child_process");
const { dirname, resolve } = require("node:path");
const process = require("node:process");
const {
  generateSyntheticDemand,
  runSimulation,
  runRollingSimulation,
  runAdoptionSweep,
  exportSimulationCsv,
} = require("../dist");
const minute = 60_000;
const limits = { maxDetourKm: 20 };
const weights = { detour: 1, delay: 1, priceGap: 0.001, reliability: 10 };

function fixture() {
  const trip = Object.freeze({
    id: "truck",
    baselineDistanceKm: 10,
    capacityKg: 1000,
    departureAtMs: 0,
    latestArrivalAtMs: 60 * minute,
    reliability: 1,
  });
  const load = Object.freeze({
    id: "cargo",
    weightKg: 500,
    pickupWindowStartMs: 7 * minute,
    pickupWindowEndMs: 30 * minute,
  });
  const pair = Object.freeze({
    trip,
    load,
    estimate: Object.freeze({
      pickupDistanceKm: 1,
      loadedDistanceKm: 8,
      pickupAtMs: 7 * minute,
      tripEndAtMs: 16 * minute,
      detourKm: 0,
      delayMinutes: 6,
      priceGapUzs: 0,
    }),
  });
  return Object.freeze({
    source: "synthetic",
    seed: 1,
    adoptionRate: 1,
    model: Object.freeze({
      kind: "illustrative-line-corridor",
      startAtMs: 0,
      speedKph: 60,
      corridorLengthKm: 10,
    }),
    participatingTripIds: Object.freeze([trip.id]),
    trips: Object.freeze([trip]),
    loads: Object.freeze([load]),
    candidates: Object.freeze([pair]),
  });
}

test("rolling replay waits for the batch and recalculates pickup and delay", () => {
  const scenario = fixture();
  const report = runRollingSimulation(scenario, limits, weights, 15);
  expect(report.replay).toEqual({
    batchIntervalMinutes: 15,
    batchCount: 5,
    startAtMs: 0,
    endAtMs: 60 * minute,
  });
  for (const result of report.results) {
    expect(result.matches).toEqual([
      { tripId: "truck", loadId: "cargo", cost: 15, assignedAtMs: 15 * minute },
    ]);
    expect(result.metrics.averageWaitMinutes).toBe(9);
  }
  expect(scenario.candidates[0].estimate.pickupAtMs).toBe(7 * minute);
});

test("unrevealed cheaper demand cannot displace an assignment made earlier", () => {
  const base = fixture();
  const first = {
    ...base.candidates[0],
    estimate: { ...base.candidates[0].estimate, priceGapUzs: 1000 },
  };
  const load = {
    ...base.loads[0],
    id: "future",
    pickupWindowStartMs: 22 * minute,
    pickupWindowEndMs: 50 * minute,
  };
  const later = {
    trip: base.trips[0],
    load,
    estimate: {
      ...first.estimate,
      pickupAtMs: 22 * minute,
      tripEndAtMs: 31 * minute,
      priceGapUzs: 0,
    },
  };
  const scenario = {
    ...base,
    loads: [...base.loads, load],
    candidates: [first, later],
  };
  const onlyPrice = { detour: 0, delay: 0, priceGap: 1, reliability: 0 };
  expect(
    runSimulation(scenario, limits, onlyPrice).results[2].matches[0].loadId,
  ).toBe("future");
  for (const result of runRollingSimulation(scenario, limits, onlyPrice)
    .results) {
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].loadId).toBe("cargo");
  }
});

test("expired windows are excluded and future trips remain unavailable", () => {
  const base = fixture();
  const expired = { ...base.loads[0], pickupWindowEndMs: 10 * minute };
  const scenario = {
    ...base,
    loads: [expired],
    candidates: [{ ...base.candidates[0], load: expired }],
  };
  for (const result of runRollingSimulation(scenario, limits, weights)
    .results) {
    expect(result.matches).toEqual([]);
  }
  const futureTrip = { ...base.trips[0], departureAtMs: 18 * minute };
  const load = { ...base.loads[0], pickupWindowEndMs: 50 * minute };
  const readyLater = {
    ...base,
    trips: [futureTrip],
    loads: [load],
    candidates: [
      {
        trip: futureTrip,
        load,
        estimate: {
          ...base.candidates[0].estimate,
          pickupAtMs: 19 * minute,
          tripEndAtMs: 28 * minute,
        },
      },
    ],
  };
  for (const result of runRollingSimulation(readyLater, limits, weights)
    .results) {
    expect(result.matches[0].assignedAtMs).toBe(30 * minute);
  }
});

test("batch intervals, membership, and replay horizon are validated", () => {
  for (const interval of [0, -1, 1.5, 61, NaN]) {
    expect(() =>
      runRollingSimulation(fixture(), limits, weights, interval),
    ).toThrow(/batchIntervalMinutes/);
  }
  const base = fixture();
  expect(() =>
    runRollingSimulation(
      {
        ...base,
        candidates: [
          {
            ...base.candidates[0],
            load: { ...base.loads[0], pickupWindowStartMs: 0 },
          },
        ],
      },
      limits,
      weights,
    ),
  ).toThrow(/supplied trip and load/);
  const trip = { ...base.trips[0], latestArrivalAtMs: 10001 * minute };
  expect(() =>
    runRollingSimulation(
      { ...base, trips: [trip], candidates: [{ ...base.candidates[0], trip }] },
      limits,
      weights,
      1,
    ),
  ).toThrow(/10000-batch/);
  const empty = runRollingSimulation(
    generateSyntheticDemand({ tripCount: 0, loadCount: 0 }),
    limits,
    weights,
  );
  expect(empty.results.every((result) => result.matches.length === 0)).toBe(
    true,
  );
});

test("all seeded replay assignments are committed once and after availability", () => {
  const scenario = generateSyntheticDemand({
    seed: 42,
    tripCount: 10,
    loadCount: 12,
  });
  const report = runRollingSimulation(scenario, limits, weights);
  expect(report).toEqual(runRollingSimulation(scenario, limits, weights));
  for (const result of report.results) {
    expect(new Set(result.matches.map((match) => match.tripId)).size).toBe(
      result.matches.length,
    );
    expect(new Set(result.matches.map((match) => match.loadId)).size).toBe(
      result.matches.length,
    );
    for (const match of result.matches) {
      const trip = scenario.trips.find((row) => row.id === match.tripId);
      const load = scenario.loads.find((row) => row.id === match.loadId);
      expect(match.assignedAtMs).toBeGreaterThanOrEqual(trip.departureAtMs);
      expect(match.assignedAtMs).toBeGreaterThanOrEqual(
        load.pickupWindowStartMs,
      );
    }
  }
});

test("paired adoption sweeps preserve seeds, model, and report order", () => {
  const options = {
    seeds: [1, 42],
    adoptionRates: [0.1, 0.3, 0.6],
    demand: { tripCount: 10, loadCount: 8 },
  };
  const sweep = runAdoptionSweep(options, limits, weights);
  expect(sweep).toEqual(runAdoptionSweep(options, limits, weights));
  expect(
    sweep.reports.map((report) => [report.seed, report.adoptionRate]),
  ).toEqual([
    [1, 0.1],
    [1, 0.3],
    [1, 0.6],
    [42, 0.1],
    [42, 0.3],
    [42, 0.6],
  ]);
  expect(
    sweep.reports.every((report) => report.replay.batchIntervalMinutes === 15),
  ).toBe(true);
  const snapshot = runAdoptionSweep(
    { ...options, mode: "snapshot" },
    limits,
    weights,
  );
  expect(snapshot.reports.every((report) => report.replay === undefined)).toBe(
    true,
  );
  expect(() =>
    runAdoptionSweep({ seeds: [], adoptionRates: [0.3] }, limits, weights),
  ).toThrow(/unique seeds/);
  expect(() =>
    runAdoptionSweep({ seeds: [1, 1], adoptionRates: [0.3] }, limits, weights),
  ).toThrow(/unique seeds/);
});

test("CSV rows retain configuration and exact metric values", () => {
  const sweep = runAdoptionSweep(
    {
      seeds: [42],
      adoptionRates: [0.1, 0.3],
      demand: { tripCount: 10, loadCount: 8 },
    },
    limits,
    weights,
  );
  const lines = exportSimulationCsv(sweep).trim().split("\r\n");
  expect(lines).toHaveLength(7);
  const header = lines[0].split(",");
  const row = Object.fromEntries(
    header.map((key, index) => [key, lines[1].split(",")[index]]),
  );
  expect(row).toMatchObject({
    source: "synthetic",
    seed: "42",
    mode: "rolling",
    adoption_rate: "0.1",
    batch_interval_minutes: "15",
    strategy: "fcfs",
    max_detour_km: "20",
  });
  expect(Number(row.empty_km_share)).toBe(
    sweep.reports[0].results[0].metrics.emptyKmShare,
  );
  expect(Number(row.average_wait_minutes)).toBe(
    sweep.reports[0].results[0].metrics.averageWaitMinutes,
  );
  const report = runSimulation(fixture(), limits, weights);
  const quoted = {
    ...report,
    results: [{ ...report.results[0], strategy: 'example, "quoted"' }],
  };
  expect(exportSimulationCsv(quoted)).toContain('"example, ""quoted"""');
});

test("CLI selects replay, emits sweep CSV, and rejects conflicting options", () => {
  const cli = resolve(
    dirname(require.resolve("../package.json")),
    "dist/cli.js",
  );
  const rolling = spawnSync(
    process.execPath,
    [cli, "--mode", "rolling", "--trips", "5", "--loads", "6"],
    { encoding: "utf8", timeout: 10000 },
  );
  expect(rolling.status).toBe(0);
  expect(JSON.parse(rolling.stdout).replay.batchIntervalMinutes).toBe(15);
  const csv = spawnSync(
    process.execPath,
    [
      cli,
      "--sweep",
      "--seeds",
      "1,2",
      "--trips",
      "5",
      "--loads",
      "6",
      "--format",
      "csv",
    ],
    { encoding: "utf8", timeout: 10000 },
  );
  expect(csv.status).toBe(0);
  expect(csv.stdout.trim().split("\r\n")).toHaveLength(19);
  for (const args of [
    ["--mode", "wrong"],
    ["--format", "wrong"],
    ["--interval", "0"],
    ["--seeds", "1,2"],
    ["--sweep", "--adoption", "0.3"],
  ]) {
    const rejected = spawnSync(process.execPath, [cli, ...args], {
      encoding: "utf8",
      timeout: 10000,
    });
    expect(rejected.status).toBe(1);
    expect(rejected.stdout).toBe("");
  }
});
