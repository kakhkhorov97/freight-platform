import type {
  CandidatePair,
  CostWeights,
  FeasibilityLimits,
  MatchLoad,
  MatchMetrics,
  MatchTrip,
} from "@freight/matcher";

export interface DemandOptions {
  readonly seed?: number;
  readonly tripCount?: number;
  readonly loadCount?: number;
  readonly adoptionRate?: number;
  readonly corridorLengthKm?: number;
  readonly speedKph?: number;
  readonly startAtMs?: number;
}

export interface SimulationScenario {
  readonly source: "synthetic";
  readonly seed: number;
  readonly adoptionRate: number;
  readonly model: {
    readonly kind: "illustrative-line-corridor";
    readonly corridorLengthKm: number;
    readonly speedKph: number;
    readonly startAtMs: number;
  };
  readonly participatingTripIds: readonly string[];
  readonly trips: readonly MatchTrip[];
  readonly loads: readonly MatchLoad[];
  readonly candidates: readonly CandidatePair[];
}

export interface SimulationReport {
  readonly source: "synthetic";
  readonly seed: number;
  readonly adoptionRate: number;
  readonly model: SimulationScenario["model"];
  readonly fleetTripCount: number;
  readonly participatingTripCount: number;
  readonly loadCount: number;
  readonly limits: FeasibilityLimits;
  readonly weights: CostWeights;
  readonly results: readonly {
    readonly strategy: "fcfs" | "greedy-nearest" | "batch";
    readonly matches: readonly {
      readonly tripId: string;
      readonly loadId: string;
      readonly cost: number;
    }[];
    readonly metrics: MatchMetrics;
  }[];
}
