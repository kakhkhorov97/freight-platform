export type Coordinate = readonly [longitude: number, latitude: number];
export interface RouteLeg {
  readonly distanceKm: number;
  readonly durationMs: number;
}
export interface RoadRoute extends RouteLeg {
  readonly legs: readonly RouteLeg[];
}
export interface Router {
  route(points: readonly Coordinate[]): Promise<RoadRoute | null>;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid OSRM response");
  }
  return value as Record<string, unknown>;
}

function nonnegative(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("Invalid OSRM distance or duration");
  }
  return value;
}

function parseLeg(value: unknown): RouteLeg {
  const leg = record(value);
  const durationMs = Math.ceil(nonnegative(leg.duration) * 1000);
  if (!Number.isSafeInteger(durationMs)) {
    throw new Error("OSRM duration exceeds the supported range");
  }
  return { distanceKm: nonnegative(leg.distance) / 1000, durationMs };
}

export class OsrmClient implements Router {
  private readonly baseUrl: URL;

  constructor(
    baseUrl = "http://127.0.0.1:5001",
    private readonly timeoutMs = 5000,
  ) {
    this.baseUrl = new URL(baseUrl);
    if (
      !["http:", "https:"].includes(this.baseUrl.protocol) ||
      this.baseUrl.username ||
      this.baseUrl.password ||
      this.baseUrl.search ||
      this.baseUrl.hash ||
      this.baseUrl.pathname !== "/"
    ) {
      throw new Error(
        "OSRM_BASE_URL must be an HTTP(S) origin without credentials",
      );
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) {
      throw new RangeError("OSRM timeout must be 1 to 60000 milliseconds");
    }
  }

  async route(points: readonly Coordinate[]): Promise<RoadRoute | null> {
    if (points.length < 2 || points.length > 4) {
      throw new RangeError("Routes require two to four coordinates");
    }
    for (const point of points) {
      if (
        point.length !== 2 ||
        !Number.isFinite(point[0]) ||
        !Number.isFinite(point[1]) ||
        Math.abs(point[0]) > 180 ||
        Math.abs(point[1]) > 90
      ) {
        throw new RangeError(
          "Coordinates must be valid [longitude, latitude] pairs",
        );
      }
    }
    const coordinates = points.map((point) => point.join(",")).join(";");
    const url = new URL(`/route/v1/driving/${coordinates}`, this.baseUrl);
    url.searchParams.set("overview", "false");
    url.searchParams.set("steps", "false");
    // Bound snapping so remote points cannot silently route from a distant road.
    url.searchParams.set("radiuses", points.map(() => "1000").join(";"));
    const response = await fetch(url, {
      signal: AbortSignal.timeout(this.timeoutMs),
      redirect: "error",
    });
    if (response.status !== 200 && response.status !== 400) {
      throw new Error(`OSRM HTTP ${response.status}`);
    }
    const body = record(await response.json());
    if (body.code === "NoRoute" || body.code === "NoSegment") return null;
    if (!response.ok || body.code !== "Ok" || !Array.isArray(body.routes)) {
      throw new Error("OSRM route request failed");
    }
    const route = record(body.routes[0]);
    if (!Array.isArray(route.legs) || route.legs.length !== points.length - 1) {
      throw new Error("Invalid OSRM route legs");
    }
    const legs = route.legs.map(parseLeg);
    // Sum the legs so timing and distance use the same rounded itinerary.
    const distanceKm = legs.reduce((sum, leg) => sum + leg.distanceKm, 0);
    const durationMs = legs.reduce((sum, leg) => sum + leg.durationMs, 0);
    if (!Number.isFinite(distanceKm) || !Number.isSafeInteger(durationMs)) {
      throw new Error("OSRM route exceeds the supported range");
    }
    return { distanceKm, durationMs, legs };
  }
}
