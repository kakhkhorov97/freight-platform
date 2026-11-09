import type { CandidatePair, CostWeights } from "./types";
import { requireNonnegative } from "./validation";

export function calculatePairCost(
  { trip, estimate }: CandidatePair,
  weights: CostWeights,
): number {
  requireNonnegative(estimate.detourKm, "detourKm");
  requireNonnegative(estimate.delayMinutes, "delayMinutes");
  requireNonnegative(estimate.priceGapUzs, "priceGapUzs");
  requireNonnegative(weights.detour, "detour weight");
  requireNonnegative(weights.delay, "delay weight");
  requireNonnegative(weights.priceGap, "price-gap weight");
  requireNonnegative(weights.reliability, "reliability weight");
  if (
    !Number.isFinite(trip.reliability) ||
    trip.reliability < 0 ||
    trip.reliability > 1
  ) {
    throw new RangeError("reliability must be between 0 and 1");
  }

  const cost =
    weights.detour * estimate.detourKm +
    weights.delay * estimate.delayMinutes +
    weights.priceGap * estimate.priceGapUzs +
    weights.reliability * (1 - trip.reliability);
  if (!Number.isFinite(cost))
    throw new RangeError("Pair cost exceeds the numeric range");
  return cost;
}
