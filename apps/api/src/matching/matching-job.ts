import { batchAssign, calculatePairCost } from "@freight/matcher";
import type {
  CandidatePair,
  CostWeights,
  FeasibilityLimits,
} from "@freight/matcher";

export interface MatchingJobData {
  readonly candidates: readonly CandidatePair[];
  readonly limits: FeasibilityLimits;
  readonly weights: CostWeights;
}
export interface MatchingJobResult {
  readonly proposals: readonly { tripId: string; loadId: string }[];
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Matching job requires objects");
  }
  return value as Record<string, unknown>;
}
function numbers(
  value: Record<string, unknown>,
  keys: readonly string[],
): void {
  for (const key of keys) {
    if (typeof value[key] !== "number" || !Number.isFinite(value[key])) {
      throw new TypeError(`Matching job ${key} must be a finite number`);
    }
  }
}
function id(value: unknown): void {
  if (typeof value !== "string" || !value.trim() || value.length > 128) {
    throw new TypeError("Matching job IDs must contain 1 to 128 characters");
  }
}

export function parseMatchingJob(value: unknown): MatchingJobData {
  const data = record(value);
  if (!Array.isArray(data.candidates) || data.candidates.length > 1000) {
    throw new RangeError("Matching jobs support at most 1000 candidate pairs");
  }
  numbers(record(data.limits), ["maxDetourKm"]);
  numbers(record(data.weights), ["detour", "delay", "priceGap", "reliability"]);
  const trips = new Set<string>();
  const loads = new Set<string>();
  for (const candidate of data.candidates) {
    const pair = record(candidate);
    const trip = record(pair.trip);
    const load = record(pair.load);
    const estimate = record(pair.estimate);
    id(trip.id);
    id(load.id);
    trips.add(String(trip.id));
    loads.add(String(load.id));
    numbers(trip, [
      "capacityKg",
      "departureAtMs",
      "latestArrivalAtMs",
      "reliability",
    ]);
    numbers(load, ["weightKg", "pickupWindowStartMs", "pickupWindowEndMs"]);
    numbers(estimate, [
      "pickupAtMs",
      "tripEndAtMs",
      "detourKm",
      "delayMinutes",
      "priceGapUzs",
    ]);
    if (trip.baselineDistanceKm !== undefined)
      numbers(trip, ["baselineDistanceKm"]);
    for (const key of ["pickupDistanceKm", "loadedDistanceKm"]) {
      if (estimate[key] !== undefined) numbers(estimate, [key]);
    }
  }
  if (trips.size > 50 || loads.size > 50) {
    throw new RangeError("Matching jobs support at most 50 trips and 50 loads");
  }
  // Every required field was checked above before narrowing the external payload.
  return value as MatchingJobData;
}

export function processMatchingJob(value: unknown): MatchingJobResult {
  const { candidates, limits, weights } = parseMatchingJob(value);
  // Validate cost inputs even for pairs the feasibility filter would discard.
  for (const pair of candidates) calculatePairCost(pair, weights);
  const matches = batchAssign(candidates, limits, weights);
  return {
    proposals: matches.map(({ trip, load }) => ({
      tripId: trip.id,
      loadId: load.id,
    })),
  };
}
