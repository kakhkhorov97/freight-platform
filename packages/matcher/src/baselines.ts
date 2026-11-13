import { prepareCandidates } from "./assignment-input";
import type { CandidatePair, FeasibilityLimits } from "./types";
import { requireNonnegative } from "./validation";

function selectAvailable(pairs: readonly CandidatePair[]): CandidatePair[] {
  const trips = new Set<string>();
  const loads = new Set<string>();
  const matches: CandidatePair[] = [];
  for (const pair of pairs) {
    if (trips.has(pair.trip.id) || loads.has(pair.load.id)) continue;
    trips.add(pair.trip.id);
    loads.add(pair.load.id);
    matches.push(pair);
  }
  return matches;
}

export function firstComeFirstServed(
  pairs: readonly CandidatePair[],
  limits: FeasibilityLimits,
): CandidatePair[] {
  return selectAvailable(prepareCandidates(pairs, limits));
}

export function greedyNearest(
  pairs: readonly CandidatePair[],
  limits: FeasibilityLimits,
): CandidatePair[] {
  const feasible = prepareCandidates(pairs, limits);
  const ordered = feasible.map((pair, order) => {
    const distance = pair.estimate.pickupDistanceKm;
    if (distance === undefined) {
      throw new RangeError("Greedy nearest requires pickupDistanceKm");
    }
    requireNonnegative(distance, "pickupDistanceKm");
    return { pair, distance, order };
  });
  ordered.sort((a, b) => a.distance - b.distance || a.order - b.order);
  return selectAvailable(ordered.map(({ pair }) => pair));
}
