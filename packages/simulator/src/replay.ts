import { batchAssign } from "@freight/matcher";
import type {
  CandidatePair,
  CostWeights,
  FeasibilityLimits,
} from "@freight/matcher";
import {
  createReport,
  selectMatches,
  strategies,
  validateScenario,
} from "./runner";
import type { SimulationReport, SimulationScenario } from "./types";

function planAt(
  pair: CandidatePair,
  clock: number,
  speedKph: number,
): CandidatePair {
  const pickupDistance = pair.estimate.pickupDistanceKm;
  const baseline = pair.trip.baselineDistanceKm;
  if (
    pickupDistance === undefined ||
    baseline === undefined ||
    !Number.isFinite(pickupDistance) ||
    pickupDistance < 0 ||
    !Number.isFinite(baseline) ||
    baseline < 0
  ) {
    throw new RangeError(
      "Replay requires finite baseline and pickup distances",
    );
  }
  const travelMs = Math.round((pickupDistance * 3_600_000) / speedKph);
  const pickupAtMs = Math.max(clock + travelMs, pair.load.pickupWindowStartMs);
  const remainingTravelMs =
    pair.estimate.tripEndAtMs - pair.estimate.pickupAtMs;
  if (!Number.isSafeInteger(remainingTravelMs) || remainingTravelMs < 0) {
    throw new RangeError("Replay requires a valid post-pickup travel duration");
  }
  const tripEndAtMs = pickupAtMs + remainingTravelMs;
  const earliestArrivalMs =
    pair.trip.departureAtMs + Math.round((baseline * 3_600_000) / speedKph);
  return {
    ...pair,
    estimate: {
      ...pair.estimate,
      pickupAtMs,
      tripEndAtMs,
      delayMinutes: Math.max(0, (tripEndAtMs - earliestArrivalMs) / 60_000),
    },
  };
}

export function runRollingSimulation(
  scenario: SimulationScenario,
  limits: FeasibilityLimits,
  weights: CostWeights,
  batchIntervalMinutes = 15,
): SimulationReport {
  validateScenario(scenario);
  batchAssign([], limits, weights);
  if (
    !Number.isInteger(batchIntervalMinutes) ||
    batchIntervalMinutes < 1 ||
    batchIntervalMinutes > 60
  ) {
    throw new RangeError(
      "batchIntervalMinutes must be a whole number from 1 to 60",
    );
  }
  const { startAtMs, speedKph } = scenario.model;
  if (
    !Number.isSafeInteger(startAtMs) ||
    !Number.isFinite(speedKph) ||
    speedKph <= 0
  ) {
    throw new RangeError("Replay requires a valid model start time and speed");
  }
  const deadlines = [
    ...scenario.trips.map((trip) => trip.latestArrivalAtMs),
    ...scenario.loads.map((load) => load.pickupWindowEndMs),
  ];
  if (deadlines.some((deadline) => !Number.isSafeInteger(deadline))) {
    throw new RangeError("Replay deadlines must be epoch millisecond integers");
  }
  const lastDeadline = Math.max(startAtMs, ...deadlines);
  const intervalMs = batchIntervalMinutes * 60_000;
  const batchCount = Math.floor((lastDeadline - startAtMs) / intervalMs) + 1;
  if (batchCount > 10_000)
    throw new RangeError("Replay exceeds the 10000-batch limit");
  const selections = strategies.map((strategy) => {
    const matches: CandidatePair[] = [];
    const assignedTrips = new Set<string>();
    const assignedLoads = new Set<string>();
    const assignmentTimes = new Map<string, number>();
    for (let batch = 0; batch < batchCount; batch += 1) {
      const clock = startAtMs + batch * intervalMs;
      const available = scenario.candidates.filter(
        (pair) =>
          !assignedTrips.has(pair.trip.id) &&
          !assignedLoads.has(pair.load.id) &&
          pair.trip.departureAtMs <= clock &&
          pair.load.pickupWindowStartMs <= clock &&
          pair.trip.latestArrivalAtMs >= clock &&
          pair.load.pickupWindowEndMs >= clock,
      );
      const replanned = available.map((pair) => planAt(pair, clock, speedKph));
      for (const pair of selectMatches(strategy, replanned, limits, weights)) {
        matches.push(pair);
        assignedTrips.add(pair.trip.id);
        assignedLoads.add(pair.load.id);
        assignmentTimes.set(pair.trip.id, clock);
      }
    }
    return { strategy, matches, assignmentTimes };
  });
  return {
    ...createReport(scenario, limits, weights, selections),
    replay: {
      batchIntervalMinutes,
      batchCount,
      startAtMs,
      endAtMs: startAtMs + (batchCount - 1) * intervalMs,
    },
  };
}
