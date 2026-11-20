import { graphql } from "./graphql";
import type { Place } from "./places";

export interface Load {
  id: string;
  shipperId: string;
  /** GeoJSON order: longitude, latitude. */
  pickup: { coordinates: number[] };
  delivery: { coordinates: number[] };
  pickupWindowStart: string;
  pickupWindowEnd: string;
  weightKg: number;
  createdAt: string;
}

const PAGE_SIZE = 100; // The API's maximum list limit.
const MAX_PAGES = 20;

const loadFields = `
  id
  shipperId
  pickup { coordinates }
  delivery { coordinates }
  pickupWindowStart
  pickupWindowEnd
  weightKg
  createdAt
`;

/**
 * Lists one shipper's loads, earliest pickup first. The API's `loads` query
 * returns every load, so this filters to the given shipper.
 */
export async function listLoadsForShipper(
  token: string,
  shipperId: string,
): Promise<Load[]> {
  const loads: Load[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const data = await graphql<{ loads: Load[] }>(
      `
        query Loads($limit: Int!, $offset: Int!) {
          loads(limit: $limit, offset: $offset) {
            ${loadFields}
          }
        }
      `,
      { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
      token,
    );
    loads.push(...data.loads.filter((load) => load.shipperId === shipperId));
    if (data.loads.length < PAGE_SIZE) break;
  }
  return loads.sort((a, b) =>
    a.pickupWindowStart.localeCompare(b.pickupWindowStart),
  );
}

export interface NewLoad {
  pickup: Place;
  delivery: Place;
  pickupWindowStart: string;
  pickupWindowEnd: string;
  weightKg: number;
}

export async function createLoad(token: string, load: NewLoad): Promise<Load> {
  const point = ({ longitude, latitude }: Place) => ({ longitude, latitude });
  const data = await graphql<{ createLoad: Load }>(
    `
      mutation CreateLoad($input: CreateLoadInput!) {
        createLoad(input: $input) {
          ${loadFields}
        }
      }
    `,
    {
      input: {
        pickup: point(load.pickup),
        delivery: point(load.delivery),
        pickupWindowStart: load.pickupWindowStart,
        pickupWindowEnd: load.pickupWindowEnd,
        weightKg: load.weightKg,
      },
    },
    token,
  );
  return data.createLoad;
}
