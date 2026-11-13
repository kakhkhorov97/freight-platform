const { beforeAll, afterAll, test, expect } = require("@jest/globals");
const { createServer } = require("node:http");
const { URL } = require("node:url");
const { OsrmClient } = require("../dist/routing/osrm-client");
const { estimatePairRoute } = require("../dist/routing/pair-estimator");
const { isFeasiblePair } = require("@freight/matcher");

// Hand-made HTTP responses and timings, not measured road data.
const leg = (distance, duration) => ({ distance, duration });
let reply;
let status;
let requested;
let server;
let client;
let hanging = false;
beforeAll(async () => {
  server = createServer((req, res) => {
    requested = new URL(req.url, "http://localhost");
    if (hanging) return;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(reply));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  client = new OsrmClient(`http://127.0.0.1:${server.address().port}`, 500);
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

test("sends longitude first, bounds snapping, and converts legs to km and ms", async () => {
  status = 200;
  reply = {
    code: "Ok",
    routes: [{ legs: [leg(1250, 60.0001), leg(2500, 120)] }],
  };
  expect(
    await client.route([
      [69, 41],
      [68, 40],
      [67, 39],
    ]),
  ).toEqual({
    distanceKm: 3.75,
    durationMs: 180001,
    legs: [
      { distanceKm: 1.25, durationMs: 60001 },
      { distanceKm: 2.5, durationMs: 120000 },
    ],
  });
  expect(requested.pathname).toBe("/route/v1/driving/69,41;68,40;67,39");
  expect(requested.searchParams.get("radiuses")).toBe("1000;1000;1000");
  expect(requested.searchParams.get("overview")).toBe("false");
});

test.each(["NoRoute", "NoSegment"])("returns null for %s", async (code) => {
  status = 400;
  reply = { code };
  expect(
    await client.route([
      [69, 41],
      [67, 39],
    ]),
  ).toBeNull();
});

test.each([
  [503, { code: "NoRoute" }],
  [400, { code: "InvalidQuery" }],
  [200, { code: "Ok", routes: [] }],
  [200, { code: "Ok", routes: [{ legs: [] }] }],
  [200, { code: "Ok", routes: [{ legs: [leg(-1, 30)] }] }],
  [200, { code: "Ok", routes: [{ legs: [leg(10, "30")] }] }],
  [200, { code: "Ok", routes: [{ legs: [leg(10, 1e20)] }] }],
])("rejects failed or malformed responses %#", async (code, body) => {
  status = code;
  reply = body;
  await expect(
    client.route([
      [69, 41],
      [67, 39],
    ]),
  ).rejects.toThrow();
});

test("aborts a stalled service", async () => {
  hanging = true;
  try {
    await expect(
      client.route([
        [69, 41],
        [67, 39],
      ]),
    ).rejects.toThrow();
  } finally {
    hanging = false;
  }
});

test("validates coordinates and settings before making a request", async () => {
  for (const points of [
    [],
    [
      [181, 41],
      [69, 40],
    ],
    [
      [69, NaN],
      [67, 39],
    ],
  ]) {
    await expect(client.route(points)).rejects.toThrow();
  }
  for (const origin of [
    "ftp://localhost",
    "http://user:secret@localhost",
    "http://localhost/path",
    "http://localhost?x=1",
  ]) {
    expect(() => new OsrmClient(origin)).toThrow();
  }
  expect(() => new OsrmClient("http://localhost", 0)).toThrow();
});

const input = {
  origin: [69, 41],
  destination: [67, 39],
  pickup: [68.9, 40.9],
  delivery: [67.1, 39.1],
  departureAtMs: 0,
  pickupWindowStartMs: 600000,
  priceGapUzs: 1000,
};
function routerWith(distanceKm = 115) {
  const calls = [];
  return {
    calls,
    route: async (points) => {
      calls.push(points);
      if (points.length === 2)
        return { distanceKm: 100, durationMs: 3600000, legs: [] };
      return {
        distanceKm,
        durationMs: 3900000,
        legs: [
          { distanceKm: 5, durationMs: 300000 },
          { distanceKm: 100, durationMs: 3300000 },
          { distanceKm: 10, durationMs: 300000 },
        ],
      };
    },
  };
}

test("includes pickup waiting and produces a candidate the matcher can evaluate", async () => {
  const router = routerWith();
  const result = await estimatePairRoute(router, input);
  expect(result).toEqual({
    baselineDistanceKm: 100,
    estimate: {
      pickupDistanceKm: 5,
      loadedDistanceKm: 100,
      pickupAtMs: 600000,
      tripEndAtMs: 4200000,
      detourKm: 15,
      delayMinutes: 10,
      priceGapUzs: 1000,
    },
  });
  expect(router.calls).toEqual([
    [input.origin, input.destination],
    [input.origin, input.pickup, input.delivery, input.destination],
  ]);
  const pair = {
    trip: {
      id: "trip",
      capacityKg: 1000,
      departureAtMs: 0,
      latestArrivalAtMs: 4500000,
      reliability: 1,
      baselineDistanceKm: result.baselineDistanceKm,
    },
    load: {
      id: "load",
      weightKg: 500,
      pickupWindowStartMs: 600000,
      pickupWindowEndMs: 900000,
    },
    estimate: result.estimate,
  };
  expect(isFeasiblePair(pair, { maxDetourKm: 15 })).toBe(true);
  expect(isFeasiblePair(pair, { maxDetourKm: 14 })).toBe(false);
  expect(
    isFeasiblePair(
      {
        ...pair,
        load: {
          ...pair.load,
          pickupWindowEndMs: 599999,
          pickupWindowStartMs: 0,
        },
      },
      { maxDetourKm: 15 },
    ),
  ).toBe(false);
});

test("does not wait when the pickup window is already open and clamps shorter via distances", async () => {
  const result = await estimatePairRoute(routerWith(95), {
    ...input,
    pickupWindowStartMs: 0,
  });
  expect(result.estimate).toMatchObject({
    pickupAtMs: 300000,
    tripEndAtMs: 3900000,
    delayMinutes: 5,
    detourKm: 0,
  });
});

test("returns no candidate when either route is unavailable and propagates outages", async () => {
  expect(
    await estimatePairRoute({ route: async () => null }, input),
  ).toBeNull();
  const router = routerWith();
  const original = router.route;
  router.route = async (points) =>
    points.length === 4 ? null : original(points);
  expect(await estimatePairRoute(router, input)).toBeNull();
  await expect(
    estimatePairRoute(
      {
        route: async () => {
          throw new Error("outage");
        },
      },
      input,
    ),
  ).rejects.toThrow("outage");
});

test("rejects invalid inputs and timestamp overflow", async () => {
  for (const changes of [
    { priceGapUzs: -1 },
    { departureAtMs: 0.5 },
    { pickupWindowStartMs: NaN },
    { departureAtMs: Number.MAX_SAFE_INTEGER },
  ]) {
    await expect(
      estimatePairRoute(routerWith(), { ...input, ...changes }),
    ).rejects.toThrow();
  }
});
