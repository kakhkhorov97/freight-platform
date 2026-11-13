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
  readonly replay?: ReplayMetadata;
  readonly results: readonly SimulationResult[];
}

export type MatchingStrategy = "fcfs" | "greedy-nearest" | "batch";

export interface SimulationResult {
  readonly strategy: MatchingStrategy;
  readonly matches: readonly {
    readonly tripId: string;
    readonly loadId: string;
    readonly cost: number;
    readonly assignedAtMs?: number;
  }[];
  readonly metrics: MatchMetrics;
}

export interface ReplayMetadata {
  readonly batchIntervalMinutes: number;
  readonly batchCount: number;
  readonly startAtMs: number;
  readonly endAtMs: number;
}

export interface SweepOptions {
  readonly seeds: readonly number[];
  readonly adoptionRates: readonly number[];
  readonly demand?: Omit<DemandOptions, "seed" | "adoptionRate">;
  readonly mode?: "snapshot" | "rolling";
  readonly batchIntervalMinutes?: number;
}

export interface SweepReport {
  readonly source: "synthetic";
  readonly kind: "adoption-sweep";
  readonly reports: readonly SimulationReport[];
}
