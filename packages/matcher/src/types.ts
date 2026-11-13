export interface MatchTrip {
  readonly id: string;
  readonly capacityKg: number;
  readonly departureAtMs: number;
  readonly latestArrivalAtMs: number;
  readonly reliability: number;
}

export interface MatchLoad {
  readonly id: string;
  readonly weightKg: number;
  readonly pickupWindowStartMs: number;
  readonly pickupWindowEndMs: number;
}

export interface PairEstimate {
  readonly pickupDistanceKm?: number;
  readonly pickupAtMs: number;
  // Arrival at the truck's destination after delivering the load.
  readonly tripEndAtMs: number;
  readonly detourKm: number;
  readonly delayMinutes: number;
  readonly priceGapUzs: number;
}

export interface CandidatePair {
  readonly trip: MatchTrip;
  readonly load: MatchLoad;
  readonly estimate: PairEstimate;
}

export interface FeasibilityLimits {
  readonly maxDetourKm: number;
}

export interface CostWeights {
  readonly detour: number;
  readonly delay: number;
  readonly priceGap: number;
  readonly reliability: number;
}
