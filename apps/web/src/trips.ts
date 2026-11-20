import { graphql } from "./graphql";

export interface Trip {
  id: string;
  truckId: string;
  /** GeoJSON order: longitude, latitude. */
  origin: { coordinates: number[] };
  destination: { coordinates: number[] };
  departureAt: string;
  latestArrivalAt: string;
  createdAt: string;
}

export interface Place {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
}

/** City centres on the Tashkent ↔ Samarkand corridor (approximate). */
export const corridorPlaces: Place[] = [
  { id: "tashkent", name: "Tashkent", longitude: 69.2401, latitude: 41.2995 },
  { id: "gulistan", name: "Gulistan", longitude: 68.7842, latitude: 40.4897 },
  { id: "jizzakh", name: "Jizzakh", longitude: 67.8422, latitude: 40.1158 },
  { id: "samarkand", name: "Samarkand", longitude: 66.975, latitude: 39.627 },
];

/** Names a point when it is one of the corridor places, else shows coordinates. */
export function placeName(point: { coordinates: number[] }): string {
  const [longitude = NaN, latitude = NaN] = point.coordinates;
  const place = corridorPlaces.find(
    (p) =>
      Math.abs(p.longitude - longitude) < 1e-6 &&
      Math.abs(p.latitude - latitude) < 1e-6,
  );
  return place ? place.name : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

/**
 * Turns a `datetime-local` value entered in Tashkent time into an ISO
 * timestamp. Tashkent is UTC+5 all year (no daylight saving time).
 */
export function tashkentLocalToIso(value: string): string {
  return `${value.length === 16 ? `${value}:00` : value}+05:00`;
}

const PAGE_SIZE = 100; // The API's maximum list limit.
const MAX_PAGES = 20;

const tripFields = `
  id
  truckId
  origin { coordinates }
  destination { coordinates }
  departureAt
  latestArrivalAt
  createdAt
`;

/**
 * Lists trips for the given trucks, soonest departure first. The API's
 * `trips` query returns every trip, so this filters to the driver's trucks.
 */
export async function listTripsForTrucks(
  token: string,
  truckIds: ReadonlySet<string>,
): Promise<Trip[]> {
  const trips: Trip[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const data = await graphql<{ trips: Trip[] }>(
      `
        query Trips($limit: Int!, $offset: Int!) {
          trips(limit: $limit, offset: $offset) {
            ${tripFields}
          }
        }
      `,
      { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
      token,
    );
    trips.push(...data.trips.filter((trip) => truckIds.has(trip.truckId)));
    if (data.trips.length < PAGE_SIZE) break;
  }
  return trips.sort((a, b) => a.departureAt.localeCompare(b.departureAt));
}

export interface NewTrip {
  origin: Place;
  destination: Place;
  departureAt: string;
  latestArrivalAt: string;
}

export async function createTrip(
  token: string,
  truckId: string,
  trip: NewTrip,
): Promise<Trip> {
  const point = ({ longitude, latitude }: Place) => ({ longitude, latitude });
  const data = await graphql<{ createTrip: Trip }>(
    `
      mutation CreateTrip($truckId: ID!, $input: CreateTripInput!) {
        createTrip(truckId: $truckId, input: $input) {
          ${tripFields}
        }
      }
    `,
    {
      truckId,
      input: {
        origin: point(trip.origin),
        destination: point(trip.destination),
        departureAt: trip.departureAt,
        latestArrivalAt: trip.latestArrivalAt,
      },
    },
    token,
  );
  return data.createTrip;
}
