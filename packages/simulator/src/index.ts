export { generateSyntheticDemand } from "./demand";
export { runSimulation } from "./runner";
export type {
  DemandOptions,
  SimulationReport,
  SimulationScenario,
} from "./types";
export { runRollingSimulation } from "./replay";
export { runAdoptionSweep } from "./sweep";
export { exportSimulationCsv } from "./csv";
export type {
  MatchingStrategy,
  ReplayMetadata,
  SimulationResult,
  SweepOptions,
  SweepReport,
} from "./types";
