import { isFeasiblePair } from "./feasibility";
import type { CandidatePair, MatchLoad, MatchTrip } from "./types";
import { requireNonnegative } from "./validation";

export interface MatchMetrics {
  readonly matchedLoadCount: number;
  readonly matchedLoadRate: number;
  readonly totalDistanceKm: number;
  readonly emptyDistanceKm: number;
  readonly emptyKmShare: number;
  readonly averageDetourKm: number;
  readonly averageWaitMinutes: number;
}

function indexById<T extends { readonly id: string }>(
  rows: readonly T[],
): Map<string, T> {
  const index = new Map<string, T>();
  for (const row of rows) {
    if (!row.id.trim() || index.has(row.id)) {
      throw new RangeError("Metric input IDs must be non-empty and unique");
    }
    index.set(row.id, row);
  }
  return index;
}

export function calculateMatchMetrics(
  trips: readonly MatchTrip[],
  loads: readonly MatchLoad[],
  matches: readonly CandidatePair[],
): MatchMetrics {
  const tripIndex = indexById(trips);
  const loadIndex = indexById(loads);
  let totalDistanceKm = 0;
  let loadedDistanceKm = 0;
  let totalDetourKm = 0;
  let totalWaitMinutes = 0;
  for (const trip of trips) {
    const baseline = trip.baselineDistanceKm ?? NaN;
    requireNonnegative(baseline, "baselineDistanceKm");
    totalDistanceKm += baseline;
  }
  const usedTrips = new Set<string>();
  const usedLoads = new Set<string>();
  for (const pair of matches) {
    const trip = tripIndex.get(pair.trip.id);
    const load = loadIndex.get(pair.load.id);
    if (!trip || !load || usedTrips.has(trip.id) || usedLoads.has(load.id)) {
      throw new RangeError(
        "Metrics require one-to-one assignments from the supplied fleet and loads",
      );
    }
    if (
      !isFeasiblePair(
        { trip, load, estimate: pair.estimate },
        { maxDetourKm: pair.estimate.detourKm },
      )
    ) {
      throw new RangeError("Metrics require feasible assignments");
    }
    const loaded = pair.estimate.loadedDistanceKm ?? NaN;
    requireNonnegative(loaded, "loadedDistanceKm");
    const routeDistance =
      (trip.baselineDistanceKm ?? 0) + pair.estimate.detourKm;
    if (loaded > routeDistance)
      throw new RangeError("Loaded distance exceeds total route distance");
    usedTrips.add(trip.id);
    usedLoads.add(load.id);
    totalDistanceKm += pair.estimate.detourKm;
    loadedDistanceKm += loaded;
    totalDetourKm += pair.estimate.detourKm;
    totalWaitMinutes +=
      (pair.estimate.pickupAtMs - load.pickupWindowStartMs) / 60_000;
  }
  for (const value of [
    totalDistanceKm,
    loadedDistanceKm,
    totalDetourKm,
    totalWaitMinutes,
  ]) {
    requireNonnegative(value, "Metric totals");
  }
  const emptyDistanceKm = Math.max(0, totalDistanceKm - loadedDistanceKm);
  const count = matches.length;
  return {
    matchedLoadCount: count,
    matchedLoadRate: loads.length === 0 ? 0 : count / loads.length,
    totalDistanceKm,
    emptyDistanceKm,
    emptyKmShare: totalDistanceKm === 0 ? 0 : emptyDistanceKm / totalDistanceKm,
    averageDetourKm: count === 0 ? 0 : totalDetourKm / count,
    averageWaitMinutes: count === 0 ? 0 : totalWaitMinutes / count,
  };
}
