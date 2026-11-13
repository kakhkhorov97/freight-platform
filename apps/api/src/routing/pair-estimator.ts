import type { PairEstimate } from "@freight/matcher";
import type { Coordinate, Router } from "./osrm-client";

export interface RouteEstimateInput {
  readonly origin: Coordinate;
  readonly destination: Coordinate;
  readonly pickup: Coordinate;
  readonly delivery: Coordinate;
  readonly departureAtMs: number;
  readonly pickupWindowStartMs: number;
  readonly priceGapUzs: number;
}

export interface RoutedPair {
  readonly baselineDistanceKm: number;
  readonly estimate: PairEstimate;
}

export async function estimatePairRoute(
  router: Router,
  input: RouteEstimateInput,
): Promise<RoutedPair | null> {
  if (
    !Number.isSafeInteger(input.departureAtMs) ||
    !Number.isSafeInteger(input.pickupWindowStartMs) ||
    !Number.isFinite(input.priceGapUzs) ||
    input.priceGapUzs < 0
  ) {
    throw new RangeError(
      "Route inputs require safe epoch milliseconds and a nonnegative price gap",
    );
  }
  const baseline = await router.route([input.origin, input.destination]);
  if (!baseline) return null;
  const route = await router.route([
    input.origin,
    input.pickup,
    input.delivery,
    input.destination,
  ]);
  if (!route) return null;
  const [pickup, loaded, returning] = route.legs;
  if (!pickup || !loaded || !returning || route.legs.length !== 3) {
    throw new Error("Pair route requires three legs");
  }
  const pickupAtMs = Math.max(
    input.departureAtMs + pickup.durationMs,
    input.pickupWindowStartMs,
  );
  const tripEndAtMs = pickupAtMs + loaded.durationMs + returning.durationMs;
  const baselineEndAtMs = input.departureAtMs + baseline.durationMs;
  if (![pickupAtMs, tripEndAtMs, baselineEndAtMs].every(Number.isSafeInteger)) {
    throw new RangeError("Route timestamps exceed the supported range");
  }
  return {
    baselineDistanceKm: baseline.distanceKm,
    estimate: {
      pickupDistanceKm: pickup.distanceKm,
      loadedDistanceKm: loaded.distanceKm,
      pickupAtMs,
      tripEndAtMs,
      // OSRM optimizes travel time, so a via route can be shorter in distance.
      detourKm: Math.max(0, route.distanceKm - baseline.distanceKm),
      delayMinutes: Math.max(0, tripEndAtMs - baselineEndAtMs) / 60000,
      priceGapUzs: input.priceGapUzs,
    },
  };
}
