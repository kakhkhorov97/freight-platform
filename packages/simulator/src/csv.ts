import type { SimulationReport, SweepReport } from "./types";

function cell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/u.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}

export function exportSimulationCsv(
  input: SimulationReport | SweepReport,
): string {
  const reports = "reports" in input ? input.reports : [input];
  const header = [
    "source",
    "seed",
    "adoption_rate",
    "mode",
    "batch_interval_minutes",
    "strategy",
    "fleet_trips",
    "participating_trips",
    "loads",
    "corridor_km",
    "speed_kph",
    "start_at_ms",
    "max_detour_km",
    "weight_detour",
    "weight_delay",
    "weight_price_gap",
    "weight_reliability",
    "matched_loads",
    "matched_load_rate",
    "total_km",
    "empty_km",
    "empty_km_share",
    "average_detour_km",
    "average_wait_minutes",
  ];
  const rows = reports.flatMap((report) =>
    report.results.map(({ strategy, metrics }) => [
      report.source,
      report.seed,
      report.adoptionRate,
      report.replay ? "rolling" : "snapshot",
      report.replay?.batchIntervalMinutes ?? "",
      strategy,
      report.fleetTripCount,
      report.participatingTripCount,
      report.loadCount,
      report.model.corridorLengthKm,
      report.model.speedKph,
      report.model.startAtMs,
      report.limits.maxDetourKm,
      report.weights.detour,
      report.weights.delay,
      report.weights.priceGap,
      report.weights.reliability,
      metrics.matchedLoadCount,
      metrics.matchedLoadRate,
      metrics.totalDistanceKm,
      metrics.emptyDistanceKm,
      metrics.emptyKmShare,
      metrics.averageDetourKm,
      metrics.averageWaitMinutes,
    ]),
  );
  return (
    [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") +
    "\r\n"
  );
}
