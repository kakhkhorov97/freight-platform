require("reflect-metadata");
const { beforeAll, afterAll, test, expect } = require("@jest/globals");
const { randomUUID } = require("node:crypto");
const process = require("node:process");
const { NestFactory } = require("@nestjs/core");
const { Client } = require("pg");
const { DataSource } = require("typeorm");
const { User, UserRole } = require("../dist/users/user.entity");
const { Truck } = require("../dist/trucks/truck.entity");
const { Trip } = require("../dist/trips/trip.entity");
const { Load } = require("../dist/loads/load.entity");
const { Match } = require("../dist/matches/match.entity");
const base = require("../dist/database/data-source").default.options;
const database = `freight_user_test_${randomUUID().replaceAll("-", "")}`;
let admin;
let source;
let created = false;

beforeAll(async () => {
  admin = new Client({
    host: base.host,
    port: base.port,
    database: base.database,
    user: base.username,
    password: base.password,
  });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${database}"`);
  created = true;
  source = new DataSource({ ...base, database });
  await source.initialize();
  await source.query("CREATE EXTENSION postgis");
  await source.runMigrations();
}, 15000);

afterAll(async () => {
  try {
    if (source?.isInitialized) await source.destroy();
    if (created) await admin.query(`DROP DATABASE "${database}"`);
  } finally {
    await admin?.end();
  }
});

test.each(Object.values(UserRole))(
  "persists a %s with UUID and timestamps",
  async (role) => {
    const repository = source.getRepository(User);
    const user = await repository.save({ displayName: "Test user", role });
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
    expect((await repository.findOneByOrFail({ id: user.id })).role).toBe(role);
    await source.query('UPDATE "users" SET "updated_at" = $1 WHERE "id" = $2', [
      new Date("2000-01-01T00:00:00Z"),
      user.id,
    ]);
    await repository.update(user.id, { displayName: "Updated test user" });
    const updated = await repository.findOneByOrFail({ id: user.id });
    expect(updated.updatedAt.getTime()).toBeGreaterThan(Date.UTC(2000, 0, 1));
    expect(updated.createdAt).toEqual(user.createdAt);
  },
);

test.each([
  ["invalid role", "Test user", "owner", "22P02"],
  ["missing role", "Test user", null, "23502"],
  ["missing name", null, "driver", "23502"],
  ["empty name", "", "driver", "23514"],
  ["space-only name", "   ", "driver", "23514"],
  ["long name", "x".repeat(101), "driver", "22001"],
])("database rejects %s", async (_label, name, role, code) => {
  await expect(
    source.query(
      'INSERT INTO "users" ("display_name", "role") VALUES ($1, $2)',
      [name, role],
    ),
  ).rejects.toMatchObject({ driverError: { code } });
});

test("entity metadata agrees with the migrated schema", async () => {
  const changes = await source.driver.createSchemaBuilder().log();
  expect(changes.upQueries).toEqual([]);
});

test("truck constraints protect plates, capacity, and the driver reference", async () => {
  const users = source.getRepository(User);
  const driver = await users.save({
    displayName: "Truck test driver",
    role: UserRole.Driver,
  });
  const trucks = source.getRepository(Truck);
  const truck = {
    driverId: driver.id,
    plateNumber: "01A123BC",
    capacityKg: 1000,
  };
  const saved = await trucks.save({ ...truck });
  expect(saved.id).toEqual(expect.any(String));
  await expect(trucks.insert(truck)).rejects.toMatchObject({
    driverError: { code: "23505" },
  });
  await expect(
    trucks.insert({ ...truck, plateNumber: "01a 123" }),
  ).rejects.toMatchObject({ driverError: { code: "23514" } });
  await expect(
    trucks.insert({ ...truck, plateNumber: "01B123BC", capacityKg: 0 }),
  ).rejects.toMatchObject({ driverError: { code: "23514" } });
  await expect(
    trucks.insert({
      ...truck,
      plateNumber: "01B123BC",
      driverId: randomUUID(),
    }),
  ).rejects.toMatchObject({ driverError: { code: "23503" } });
  await expect(users.delete(driver.id)).rejects.toMatchObject({
    driverError: { code: "23001" },
  });
});

test("trip and load points round-trip and their windows and weight are enforced", async () => {
  const users = source.getRepository(User);
  const driver = await users.save({
    displayName: "Trip test driver",
    role: UserRole.Driver,
  });
  const shipper = await users.save({
    displayName: "Load test shipper",
    role: UserRole.Shipper,
  });
  const truck = await source.getRepository(Truck).save({
    driverId: driver.id,
    plateNumber: "01C123BC",
    capacityKg: 1000,
  });
  const origin = { type: "Point", coordinates: [69.24, 41.31] };
  const destination = { type: "Point", coordinates: [66.96, 39.65] };
  const start = new Date("2030-01-01T08:00:00Z");
  const end = new Date("2030-01-01T12:00:00Z");
  const trips = source.getRepository(Trip);
  const trip = {
    truckId: truck.id,
    origin,
    destination,
    departureAt: start,
    latestArrivalAt: end,
  };
  const savedTrip = await trips.save({ ...trip });
  expect(await trips.findOneByOrFail({ id: savedTrip.id })).toMatchObject(trip);
  await expect(
    trips.insert({ ...trip, latestArrivalAt: start }),
  ).rejects.toMatchObject({
    driverError: { constraint: "CHK_trips_time_window" },
  });
  await expect(
    trips.insert({ ...trip, truckId: randomUUID() }),
  ).rejects.toMatchObject({
    driverError: { constraint: "FK_trips_truck_id" },
  });

  const loads = source.getRepository(Load);
  const load = {
    shipperId: shipper.id,
    pickup: origin,
    delivery: destination,
    pickupWindowStart: start,
    pickupWindowEnd: end,
    weightKg: 500,
  };
  const savedLoad = await loads.save({ ...load });
  expect(await loads.findOneByOrFail({ id: savedLoad.id })).toMatchObject(load);
  const matches = source.getRepository(Match);
  const pair = { tripId: savedTrip.id, loadId: savedLoad.id };
  const match = await matches.save({ ...pair });
  expect((await matches.findOneByOrFail({ id: match.id })).isFinal).toBe(false);
  await expect(matches.insert(pair)).rejects.toMatchObject({
    driverError: { constraint: "UQ_matches_trip_load" },
  });
  await matches.update(match.id, { driverConfirmedAt: start });
  expect((await matches.findOneByOrFail({ id: match.id })).isFinal).toBe(false);
  await matches.update(match.id, { shipperConfirmedAt: end });
  expect((await matches.findOneByOrFail({ id: match.id })).isFinal).toBe(true);

  await expect(
    loads.insert({ ...load, pickupWindowEnd: start }),
  ).rejects.toMatchObject({
    driverError: { constraint: "CHK_loads_time_window" },
  });
  await expect(loads.insert({ ...load, weightKg: 0 })).rejects.toMatchObject({
    driverError: { constraint: "CHK_loads_weight_kg" },
  });
  await expect(
    loads.insert({ ...load, shipperId: randomUUID() }),
  ).rejects.toMatchObject({
    driverError: { constraint: "FK_loads_shipper_id" },
  });
});

test("GraphQL reads users and rejects invalid query arguments", async () => {
  const repository = source.getRepository(User);
  const user = await repository.save({
    displayName: "GraphQL test user",
    role: UserRole.Shipper,
  });
  const previousDatabase = process.env.POSTGRES_DB;
  process.env.POSTGRES_DB = database;
  let app;
  try {
    const { AppModule } = require("../dist/app.module");
    app = await NestFactory.create(AppModule, {
      logger: false,
      abortOnError: false,
    });
    await app.listen(0, "127.0.0.1");
    const url = `${await app.getUrl()}/graphql`;
    const query = async (document, variables) => {
      const response = await globalThis.fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: document, variables }),
      });
      expect(response.ok).toBe(true);
      return response.json();
    };
    const lookup = "query ($id: ID!) { user(id: $id) { id displayName role } }";
    expect(await query(lookup, { id: user.id })).toEqual({
      data: {
        user: { id: user.id, displayName: user.displayName, role: "Shipper" },
      },
    });
    expect(await query(lookup, { id: randomUUID() })).toEqual({
      data: { user: null },
    });
    expect((await query(lookup, { id: "invalid" })).errors).toHaveLength(1);
    const page =
      "query ($offset: Int!) { users(limit: 1, offset: $offset) { id } }";
    const [first, second] = await Promise.all([
      query(page, { offset: 0 }),
      query(page, { offset: 1 }),
    ]);
    expect(first.data.users).toHaveLength(1);
    expect(second.data.users).toHaveLength(1);
    expect(first.data.users[0].id).not.toBe(second.data.users[0].id);
    expect((await query("{ users(limit: 101) { id } }")).errors).toHaveLength(
      1,
    );
  } finally {
    if (previousDatabase === undefined) delete process.env.POSTGRES_DB;
    else process.env.POSTGRES_DB = previousDatabase;
    await app?.close();
  }
}, 15000);

test("migrations roll back and reapply cleanly", async () => {
  await source.undoLastMigration();
  const [matchTable] = await source.query(
    "SELECT to_regclass('public.matches') AS matches",
  );
  expect(matchTable.matches).toBeNull();
  await source.undoLastMigration();
  await source.undoLastMigration();
  const [routes] = await source.query(
    "SELECT to_regclass('public.trips') AS trips, to_regclass('public.loads') AS loads",
  );
  expect(routes).toEqual({ trips: null, loads: null });
  await source.undoLastMigration();
  const [truckTable] = await source.query(
    "SELECT to_regclass('public.trucks') AS trucks",
  );
  expect(truckTable.trucks).toBeNull();
  await source.undoLastMigration();
  const [tables] = await source.query(
    "SELECT to_regclass('public.users') AS users, to_regtype('public.user_role') AS role",
  );
  expect(tables).toEqual({ users: null, role: null });
  await source.runMigrations();
  expect(await source.getRepository(User).count()).toBe(0);
});
