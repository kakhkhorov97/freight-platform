import { graphql } from "./graphql";

export interface Truck {
  id: string;
  plateNumber: string;
  capacityKg: number;
  createdAt: string;
}

const PAGE_SIZE = 100; // The API's maximum list limit.
const MAX_PAGES = 20;

/** Same normalisation the API applies: remove whitespace, uppercase. */
export function normalisePlate(raw: string): string {
  return raw.replace(/\s/gu, "").toUpperCase();
}

/** Lists the signed-in driver's trucks, newest first. */
export async function listTrucks(token: string): Promise<Truck[]> {
  const trucks: Truck[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const data = await graphql<{ trucks: Truck[] }>(
      `
        query Trucks($limit: Int!, $offset: Int!) {
          trucks(limit: $limit, offset: $offset) {
            id
            plateNumber
            capacityKg
            createdAt
          }
        }
      `,
      { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
      token,
    );
    trucks.push(...data.trucks);
    if (data.trucks.length < PAGE_SIZE) break;
  }
  return trucks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createTruck(
  token: string,
  plateNumber: string,
  capacityKg: number,
): Promise<Truck> {
  const data = await graphql<{ createTruck: Truck }>(
    `
      mutation CreateTruck($plateNumber: String!, $capacityKg: Int!) {
        createTruck(plateNumber: $plateNumber, capacityKg: $capacityKg) {
          id
          plateNumber
          capacityKg
          createdAt
        }
      }
    `,
    { plateNumber, capacityKg },
    token,
  );
  return data.createTruck;
}
