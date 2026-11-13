import type { CandidatePair, MatchLoad, MatchTrip } from "@freight/matcher";
import type { DemandOptions, SimulationScenario } from "./types";

function requireRange(
  value: number,
  min: number,
  max: number,
  field: string,
): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(field + " must be between " + min + " and " + max);
  }
}

export function generateSyntheticDemand(
  input: DemandOptions = {},
): SimulationScenario {
  const options = {
    seed: 42,
    tripCount: 20,
    loadCount: 30,
    adoptionRate: 1,
    corridorLengthKm: 100,
    speedKph: 50,
    startAtMs: Date.UTC(2030, 0, 1),
    ...input,
  };
  const {
    seed,
    tripCount,
    loadCount,
    adoptionRate,
    corridorLengthKm,
    speedKph,
    startAtMs,
  } = options;
  requireRange(seed, 0, 0xffffffff, "seed");
  requireRange(tripCount, 0, 100, "tripCount");
  requireRange(loadCount, 0, 100, "loadCount");
  if (![seed, tripCount, loadCount].every(Number.isInteger)) {
    throw new RangeError("Seed and population counts must be integers");
  }
  requireRange(adoptionRate, 0, 1, "adoptionRate");
  requireRange(corridorLengthKm, 1, 1000, "corridorLengthKm");
  requireRange(speedKph, 1, 200, "speedKph");
  const travelMs = (km: number) => Math.round((km * 3_600_000) / speedKph);
  if (
    !Number.isSafeInteger(startAtMs) ||
    !Number.isSafeInteger(
      startAtMs + travelMs(3 * corridorLengthKm) + 24 * 3_600_000,
    )
  ) {
    throw new RangeError(
      "startAtMs leaves insufficient epoch millisecond range",
    );
  }
  let state = seed;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  const routes: {
    trip: MatchTrip;
    startKm: number;
    endKm: number;
    priceUzs: number;
  }[] = [];
  for (let index = 0; index < tripCount; index += 1) {
    const startKm = random() < 0.5 ? 0 : corridorLengthKm;
    const endKm = corridorLengthKm - startKm;
    const departureAtMs = startAtMs + Math.floor(random() * 60) * 60_000;
    routes.push({
      startKm,
      endKm,
      priceUzs: 1000 + Math.floor(random() * 9001),
      trip: {
        id: "trip-" + index,
        baselineDistanceKm: corridorLengthKm,
        capacityKg: 500 + Math.floor(random() * 1501),
        departureAtMs,
        latestArrivalAtMs:
          departureAtMs + travelMs(corridorLengthKm) + 3 * 3_600_000,
        reliability: 0.5 + random() / 2,
      },
    });
  }
  const demands: {
    load: MatchLoad;
    pickupKm: number;
    deliveryKm: number;
    priceUzs: number;
  }[] = [];
  for (let index = 0; index < loadCount; index += 1) {
    const pickupKm = random() * corridorLengthKm;
    const deliveryKm = random() * corridorLengthKm;
    const pickupWindowStartMs = startAtMs + Math.floor(random() * 120) * 60_000;
    demands.push({
      pickupKm,
      deliveryKm,
      priceUzs: 1000 + Math.floor(random() * 9001),
      load: {
        id: "load-" + index,
        weightKg: 100 + Math.floor(random() * 1901),
        pickupWindowStartMs,
        pickupWindowEndMs: pickupWindowStartMs + 60 * 60_000,
      },
    });
  }

  // Shuffle after building the population, so adoption changes preserve demand.
  const shuffled = routes.map(({ trip }) => trip.id);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const left = shuffled[index];
    const right = shuffled[swap];
    if (left === undefined || right === undefined)
      throw new Error("Invalid shuffle index");
    shuffled[index] = right;
    shuffled[swap] = left;
  }
  const participatingTripIds = shuffled.slice(
    0,
    Math.floor(tripCount * adoptionRate),
  );
  const participating = new Set(participatingTripIds);
  const candidates: CandidatePair[] = [];
  for (const demand of demands) {
    for (const route of routes) {
      if (!participating.has(route.trip.id)) continue;
      const pickupDistanceKm = Math.abs(route.startKm - demand.pickupKm);
      const loadedDistanceKm = Math.abs(demand.deliveryKm - demand.pickupKm);
      const finalEmptyKm = Math.abs(route.endKm - demand.deliveryKm);
      const totalDistanceKm =
        pickupDistanceKm + loadedDistanceKm + finalEmptyKm;
      const pickupAtMs = Math.max(
        route.trip.departureAtMs + travelMs(pickupDistanceKm),
        demand.load.pickupWindowStartMs,
      );
      const tripEndAtMs =
        pickupAtMs + travelMs(loadedDistanceKm + finalEmptyKm);
      const baselineArrivalMs =
        route.trip.departureAtMs + travelMs(corridorLengthKm);
      candidates.push({
        trip: route.trip,
        load: demand.load,
        estimate: {
          pickupDistanceKm,
          loadedDistanceKm,
          pickupAtMs,
          tripEndAtMs,
          detourKm: Math.max(0, totalDistanceKm - corridorLengthKm),
          delayMinutes: Math.max(0, (tripEndAtMs - baselineArrivalMs) / 60_000),
          priceGapUzs: Math.abs(route.priceUzs - demand.priceUzs),
        },
      });
    }
  }
  candidates.sort(
    (a, b) =>
      a.load.pickupWindowStartMs - b.load.pickupWindowStartMs ||
      a.trip.departureAtMs - b.trip.departureAtMs,
  );
  return {
    source: "synthetic",
    seed,
    adoptionRate,
    model: {
      kind: "illustrative-line-corridor",
      corridorLengthKm,
      speedKph,
      startAtMs,
    },
    participatingTripIds,
    trips: routes.map(({ trip }) => trip),
    loads: demands.map(({ load }) => load),
    candidates,
  };
}
