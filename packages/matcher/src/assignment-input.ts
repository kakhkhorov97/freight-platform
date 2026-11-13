import { filterFeasiblePairs } from "./feasibility";
import type { CandidatePair, FeasibilityLimits } from "./types";

export function prepareCandidates(
  pairs: readonly CandidatePair[],
  limits: FeasibilityLimits,
): CandidatePair[] {
  const keys = new Set<string>();
  const trips = new Map<string, string>();
  const loads = new Map<string, string>();
  for (const { trip, load } of pairs) {
    if (!trip.id.trim() || !load.id.trim()) {
      throw new RangeError("Trip and load IDs must be non-empty");
    }
    const key = JSON.stringify([trip.id, load.id]);
    if (keys.has(key)) throw new RangeError("Duplicate trip/load candidate");
    keys.add(key);
    const tripData = JSON.stringify([
      trip.capacityKg,
      trip.departureAtMs,
      trip.latestArrivalAtMs,
      trip.reliability,
    ]);
    const loadData = JSON.stringify([
      load.weightKg,
      load.pickupWindowStartMs,
      load.pickupWindowEndMs,
    ]);
    if (
      (trips.has(trip.id) && trips.get(trip.id) !== tripData) ||
      (loads.has(load.id) && loads.get(load.id) !== loadData)
    ) {
      throw new RangeError("Repeated IDs must describe the same trip or load");
    }
    trips.set(trip.id, tripData);
    loads.set(load.id, loadData);
  }
  return filterFeasiblePairs(pairs, limits);
}
