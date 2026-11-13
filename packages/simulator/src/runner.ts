import {
  batchAssign,
  calculateMatchMetrics,
  calculatePairCost,
  firstComeFirstServed,
  greedyNearest,
} from "@freight/matcher";
import type {
  CandidatePair,
  CostWeights,
  FeasibilityLimits,
} from "@freight/matcher";
import type {
  MatchingStrategy,
  SimulationReport,
  SimulationScenario,
} from "./types";

export const strategies: readonly MatchingStrategy[] = [
  "fcfs",
  "greedy-nearest",
  "batch",
];

export function validateScenario(scenario: SimulationScenario): void {
  const tripIds = new Map(scenario.trips.map((trip) => [trip.id, trip]));
  const loadIds = new Map(scenario.loads.map((load) => [load.id, load]));
  const participating = new Set(scenario.participatingTripIds);
  if (
    participating.size !== scenario.participatingTripIds.length ||
    scenario.participatingTripIds.some((id) => !tripIds.has(id)) ||
    scenario.candidates.some(
      (pair) => !participating.has(pair.trip.id) || !loadIds.has(pair.load.id),
    )
  ) {
    throw new RangeError(
      "Scenario candidates must belong to participating trips and known loads",
    );
  }
  for (const pair of scenario.candidates) {
    const trip = tripIds.get(pair.trip.id);
    const load = loadIds.get(pair.load.id);
    if (
      !trip ||
      !load ||
      trip.departureAtMs !== pair.trip.departureAtMs ||
      trip.latestArrivalAtMs !== pair.trip.latestArrivalAtMs ||
      trip.capacityKg !== pair.trip.capacityKg ||
      trip.reliability !== pair.trip.reliability ||
      trip.baselineDistanceKm !== pair.trip.baselineDistanceKm ||
      load.weightKg !== pair.load.weightKg ||
      load.pickupWindowStartMs !== pair.load.pickupWindowStartMs ||
      load.pickupWindowEndMs !== pair.load.pickupWindowEndMs
    ) {
      throw new RangeError(
        "Scenario candidates must use the supplied trip and load records",
      );
    }
  }
}

export function selectMatches(
  strategy: MatchingStrategy,
  candidates: readonly CandidatePair[],
  limits: FeasibilityLimits,
  weights: CostWeights,
): CandidatePair[] {
  if (strategy === "fcfs") return firstComeFirstServed(candidates, limits);
  if (strategy === "greedy-nearest") return greedyNearest(candidates, limits);
  return batchAssign(candidates, limits, weights);
}

export interface Selection {
  readonly strategy: MatchingStrategy;
  readonly matches: readonly CandidatePair[];
  readonly assignmentTimes?: ReadonlyMap<string, number>;
}

export function createReport(
  scenario: SimulationScenario,
  limits: FeasibilityLimits,
  weights: CostWeights,
  selections: readonly Selection[],
): SimulationReport {
  const results = selections.map(({ strategy, matches, assignmentTimes }) => ({
    strategy,
    matches: matches.map((pair) => {
      const assignedAtMs = assignmentTimes?.get(pair.trip.id);
      return {
        tripId: pair.trip.id,
        loadId: pair.load.id,
        cost: calculatePairCost(pair, weights),
        ...(assignedAtMs === undefined ? {} : { assignedAtMs }),
      };
    }),
    metrics: calculateMatchMetrics(scenario.trips, scenario.loads, matches),
  }));
  return {
    source: "synthetic",
    seed: scenario.seed,
    adoptionRate: scenario.adoptionRate,
    model: { ...scenario.model },
    fleetTripCount: scenario.trips.length,
    participatingTripCount: scenario.participatingTripIds.length,
    loadCount: scenario.loads.length,
    limits: { ...limits },
    weights: { ...weights },
    results,
  };
}

export function runSimulation(
  scenario: SimulationScenario,
  limits: FeasibilityLimits,
  weights: CostWeights,
): SimulationReport {
  validateScenario(scenario);
  const selections = strategies.map((strategy) => ({
    strategy,
    matches: selectMatches(strategy, scenario.candidates, limits, weights),
  }));
  return createReport(scenario, limits, weights, selections);
}
