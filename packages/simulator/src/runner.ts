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
import type { SimulationReport, SimulationScenario } from "./types";

export function runSimulation(
  scenario: SimulationScenario,
  limits: FeasibilityLimits,
  weights: CostWeights,
): SimulationReport {
  const tripIds = new Set(scenario.trips.map((trip) => trip.id));
  const loadIds = new Set(scenario.loads.map((load) => load.id));
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
  const strategies: {
    strategy: "fcfs" | "greedy-nearest" | "batch";
    select: () => CandidatePair[];
  }[] = [
    {
      strategy: "fcfs",
      select: () => firstComeFirstServed(scenario.candidates, limits),
    },
    {
      strategy: "greedy-nearest",
      select: () => greedyNearest(scenario.candidates, limits),
    },
    {
      strategy: "batch",
      select: () => batchAssign(scenario.candidates, limits, weights),
    },
  ];
  const results = strategies.map(({ strategy, select }) => {
    const matches = select();
    return {
      strategy,
      matches: matches.map((pair) => ({
        tripId: pair.trip.id,
        loadId: pair.load.id,
        cost: calculatePairCost(pair, weights),
      })),
      metrics: calculateMatchMetrics(scenario.trips, scenario.loads, matches),
    };
  });
  return {
    source: "synthetic",
    seed: scenario.seed,
    adoptionRate: scenario.adoptionRate,
    model: { ...scenario.model },
    fleetTripCount: scenario.trips.length,
    participatingTripCount: participating.size,
    loadCount: scenario.loads.length,
    limits: { ...limits },
    weights: { ...weights },
    results,
  };
}
