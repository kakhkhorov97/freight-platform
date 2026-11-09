import type { CandidatePair, FeasibilityLimits } from "./types";
import { requireNonnegative } from "./validation";

function requireOrderedWindow(start: number, end: number, field: string): void {
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    end <= start
  ) {
    throw new RangeError(
      `${field} must have increasing epoch millisecond timestamps`,
    );
  }
}

function requirePositiveKg(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(
      `${field} must be a positive whole number of kilograms`,
    );
  }
}

export function isFeasiblePair(
  { trip, load, estimate }: CandidatePair,
  { maxDetourKm }: FeasibilityLimits,
): boolean {
  requireNonnegative(maxDetourKm, "maxDetourKm");
  requireNonnegative(estimate.detourKm, "detourKm");
  requirePositiveKg(trip.capacityKg, "capacityKg");
  requirePositiveKg(load.weightKg, "weightKg");
  requireOrderedWindow(
    trip.departureAtMs,
    trip.latestArrivalAtMs,
    "Trip window",
  );
  requireOrderedWindow(
    load.pickupWindowStartMs,
    load.pickupWindowEndMs,
    "Pickup window",
  );

  const { pickupAtMs, tripEndAtMs } = estimate;
  if (
    !Number.isSafeInteger(pickupAtMs) ||
    !Number.isSafeInteger(tripEndAtMs) ||
    tripEndAtMs < pickupAtMs
  ) {
    throw new RangeError(
      "Route estimate must end at or after pickup and use epoch milliseconds",
    );
  }
  return (
    load.weightKg <= trip.capacityKg &&
    estimate.detourKm <= maxDetourKm &&
    pickupAtMs >= trip.departureAtMs &&
    pickupAtMs >= load.pickupWindowStartMs &&
    pickupAtMs <= load.pickupWindowEndMs &&
    tripEndAtMs <= trip.latestArrivalAtMs
  );
}

export function filterFeasiblePairs(
  pairs: readonly CandidatePair[],
  limits: FeasibilityLimits,
): CandidatePair[] {
  requireNonnegative(limits.maxDetourKm, "maxDetourKm");
  return pairs.filter((pair) => isFeasiblePair(pair, limits));
}
