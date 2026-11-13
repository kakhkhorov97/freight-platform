import { prepareCandidates } from "./assignment-input";
import { calculatePairCost, validateCostWeights } from "./cost";
import { solveFlow } from "./min-cost-flow";
import type { CandidatePair, CostWeights, FeasibilityLimits } from "./types";

export function batchAssign(
  pairs: readonly CandidatePair[],
  limits: FeasibilityLimits,
  weights: CostWeights,
): CandidatePair[] {
  validateCostWeights(weights);
  const feasible = prepareCandidates(pairs, limits);
  const trips = new Map<string, number>();
  const loads = new Map<string, number>();
  const candidates = feasible.map((pair) => {
    const trip = trips.get(pair.trip.id) ?? trips.size;
    const load = loads.get(pair.load.id) ?? loads.size;
    trips.set(pair.trip.id, trip);
    loads.set(pair.load.id, load);
    return { trip, load, cost: calculatePairCost(pair, weights) };
  });
  return solveFlow(trips.size, loads.size, candidates).map((index) => {
    const pair = feasible[index];
    if (!pair) throw new Error("Assignment references an unknown candidate");
    return pair;
  });
}
