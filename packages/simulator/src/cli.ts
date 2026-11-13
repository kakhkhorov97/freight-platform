import process from "node:process";
import { parseArgs } from "node:util";
import { exportSimulationCsv } from "./csv";
import { runRollingSimulation } from "./replay";
import { runAdoptionSweep } from "./sweep";
import type { SimulationReport, SweepReport } from "./types";
import { generateSyntheticDemand } from "./demand";
import { runSimulation } from "./runner";

function numeric(value: string | undefined, field: string): number {
  if (!value?.trim() || !Number.isFinite(Number(value))) {
    throw new RangeError(field + " must be a finite number");
  }
  return Number(value);
}

try {
  const { values } = parseArgs({
    options: {
      seed: { type: "string", default: "42" },
      trips: { type: "string", default: "20" },
      loads: { type: "string", default: "30" },
      adoption: { type: "string", default: "1" },
      detour: { type: "string", default: "20" },
      mode: { type: "string" },
      interval: { type: "string", default: "15" },
      format: { type: "string", default: "json" },
      sweep: { type: "boolean", default: false },
      seeds: { type: "string" },
      rates: { type: "string" },
    },
    strict: true,
  });
  const mode = values.mode ?? (values.sweep ? "rolling" : "snapshot");
  if (mode !== "rolling" && mode !== "snapshot")
    throw new RangeError("mode must be rolling or snapshot");
  if (values.format !== "json" && values.format !== "csv")
    throw new RangeError("format must be json or csv");
  if (
    !values.sweep &&
    (values.rates !== undefined || values.seeds !== undefined)
  ) {
    throw new RangeError("Use --sweep with --rates or --seeds");
  }
  const seed = numeric(values.seed, "seed");
  const demand = {
    tripCount: numeric(values.trips, "trips"),
    loadCount: numeric(values.loads, "loads"),
  };
  const interval = numeric(values.interval, "interval");
  if (!Number.isInteger(interval) || interval < 1 || interval > 60) {
    throw new RangeError("interval must be a whole number from 1 to 60");
  }
  const limits = { maxDetourKm: numeric(values.detour, "detour") };
  // Example weights for exercising the prototype, without empirical calibration.
  const weights = { detour: 1, delay: 1, priceGap: 0.001, reliability: 10 };
  let report: SimulationReport | SweepReport;
  if (values.sweep) {
    if (
      process.argv
        .slice(2)
        .some((arg) => arg === "--adoption" || arg.startsWith("--adoption="))
    ) {
      throw new RangeError("Use --rates to set adoption levels in a sweep");
    }
    report = runAdoptionSweep(
      {
        demand,
        mode,
        batchIntervalMinutes: interval,
        seeds:
          values.seeds === undefined
            ? [seed]
            : values.seeds.split(",").map((value) => numeric(value, "seeds")),
        adoptionRates:
          values.rates === undefined
            ? [0.1, 0.3, 0.6]
            : values.rates.split(",").map((value) => numeric(value, "rates")),
      },
      limits,
      weights,
    );
  } else {
    const scenario = generateSyntheticDemand({
      ...demand,
      seed,
      adoptionRate: numeric(values.adoption, "adoption"),
    });
    report =
      mode === "rolling"
        ? runRollingSimulation(scenario, limits, weights, interval)
        : runSimulation(scenario, limits, weights);
  }
  process.stdout.write(
    values.format === "csv"
      ? exportSimulationCsv(report)
      : JSON.stringify(report, null, 2) + "\n",
  );
} catch (error) {
  process.stderr.write(
    (error instanceof Error ? error.message : "Simulation failed") + "\n",
  );
  process.exitCode = 1;
}
