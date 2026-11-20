// Shared location and time helpers for trips and loads.

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
