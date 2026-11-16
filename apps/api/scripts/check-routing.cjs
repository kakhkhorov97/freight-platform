const { readFileSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const process = require("node:process");
const { parseEnv } = require("node:util");
const { OsrmClient } = require("../dist/routing/osrm-client");
const { estimatePairRoute } = require("../dist/routing/pair-estimator");

async function main() {
  let local = {};
  try {
    local = parseEnv(
      readFileSync(
        resolve(dirname(require.resolve("../package.json")), "../../.env"),
        "utf8",
      ),
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const client = new OsrmClient(
    process.env.OSRM_BASE_URL ?? local.OSRM_BASE_URL,
  );
  // Example locations and schedule for a connectivity check, not a demand sample.
  const locations = {
    tashkent: [69.2401, 41.2995],
    samarkand: [66.9597, 39.6542],
  };
  const results = [];
  const departureAtMs = Date.UTC(2030, 0, 1);
  for (const [from, to] of [
    ["tashkent", "samarkand"],
    ["samarkand", "tashkent"],
  ]) {
    const origin = locations[from];
    const destination = locations[to];
    const baseline = await client.route([origin, destination]);
    if (!baseline || baseline.distanceKm <= 0 || baseline.durationMs <= 0) {
      throw new Error(`No usable route from ${from} to ${to}`);
    }
    // Repeated endpoints exercise all three adapter legs without invented stops.
    const pair = await estimatePairRoute(client, {
      origin,
      destination,
      pickup: origin,
      delivery: destination,
      departureAtMs,
      pickupWindowStartMs: departureAtMs,
      priceGapUzs: 0,
    });
    if (!pair || pair.estimate.loadedDistanceKm <= 0) {
      throw new Error(`No usable pair estimate from ${from} to ${to}`);
    }
    results.push({ from, to, origin, destination, baseline, pair });
  }
  process.stdout.write(
    JSON.stringify(
      {
        purpose: "routing smoke check with example locations and schedule",
        checkedAt: new Date().toISOString(),
        results,
      },
      null,
      2,
    ) + "\n",
  );
}

main().catch((error) => {
  process.stderr.write(`Routing check failed: ${error.message}\n`);
  process.exitCode = 1;
});
