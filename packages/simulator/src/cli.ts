import process from "node:process";
import { parseArgs } from "node:util";
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
    },
    strict: true,
  });
  const scenario = generateSyntheticDemand({
    seed: numeric(values.seed, "seed"),
    tripCount: numeric(values.trips, "trips"),
    loadCount: numeric(values.loads, "loads"),
    adoptionRate: numeric(values.adoption, "adoption"),
  });
  // Example weights for exercising the prototype, without empirical calibration.
  const weights = { detour: 1, delay: 1, priceGap: 0.001, reliability: 10 };
  const report = runSimulation(
    scenario,
    { maxDetourKm: numeric(values.detour, "detour") },
    weights,
  );
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} catch (error) {
  process.stderr.write(
    (error instanceof Error ? error.message : "Simulation failed") + "\n",
  );
  process.exitCode = 1;
}
