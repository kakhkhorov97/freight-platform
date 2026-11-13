import type { CostWeights, FeasibilityLimits } from "@freight/matcher";
import { generateSyntheticDemand } from "./demand";
import { runRollingSimulation } from "./replay";
import { runSimulation } from "./runner";
import type { SweepOptions, SweepReport } from "./types";

export function runAdoptionSweep(
  options: SweepOptions,
  limits: FeasibilityLimits,
  weights: CostWeights,
): SweepReport {
  const {
    seeds,
    adoptionRates,
    demand,
    mode = "rolling",
    batchIntervalMinutes = 15,
  } = options;
  if (
    seeds.length === 0 ||
    adoptionRates.length === 0 ||
    seeds.length * adoptionRates.length > 100 ||
    new Set(seeds).size !== seeds.length ||
    new Set(adoptionRates).size !== adoptionRates.length
  ) {
    throw new RangeError(
      "Sweep requires unique seeds and adoption rates, with 1–100 combinations",
    );
  }
  if (mode !== "snapshot" && mode !== "rolling")
    throw new RangeError("Unknown simulation mode");
  const reports = seeds.flatMap((seed) =>
    adoptionRates.map((adoptionRate) => {
      const scenario = generateSyntheticDemand({
        ...demand,
        seed,
        adoptionRate,
      });
      return mode === "rolling"
        ? runRollingSimulation(scenario, limits, weights, batchIntervalMinutes)
        : runSimulation(scenario, limits, weights);
    }),
  );
  return { source: "synthetic", kind: "adoption-sweep", reports };
}
