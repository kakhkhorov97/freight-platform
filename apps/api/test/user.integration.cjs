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
const { AuthSession } = require("../dist/auth/session.entity");
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

test("GraphQL enforces authentication, ownership, and input validation", async () => {
  const repository = source.getRepository(User);
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
    const query = async (document, variables, token) => {
      const response = await globalThis.fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: "Bearer " + token } : {}),
        },
        body: JSON.stringify({ query: document, variables }),
      });
      expect(response.ok).toBe(true);
      return response.json();
    };
    const lookup = "query ($id: ID!) { user(id: $id) { id displayName role } }";
    expect((await query("{ loads { id } }")).errors[0].message).toMatch(
      /valid session/,
    );
    const register =
      "mutation ($email: String!, $password: String!, $name: String!, $role: UserRole!) { register(email: $email, password: $password, displayName: $name, role: $role) { id displayName role } }";
    const login =
      "mutation ($email: String!, $password: String!) { login(email: $email, password: $password) { token expiresAt } }";
    const password = "test freight password 2030";
    const signUp = async (email, name, role) => {
      const registered = (
        await query(register, { email, password, name, role })
      ).data.register;
      const session = (await query(login, { email, password })).data.login;
      return { ...registered, token: session.token };
    };
    const driver = await signUp(
      " Driver@Example.test ",
      "  New driver  ",
      "Driver",
    );
    const user = await signUp("shipper@example.test", "New shipper", "Shipper");
    const outsider = await signUp(
      "other@example.test",
      "Other driver",
      "Driver",
    );
    expect(driver).toMatchObject({ displayName: "New driver", role: "Driver" });
    expect(
      (
        await query(register, {
          email: "driver@example.test",
          password,
          name: "Duplicate",
          role: "Driver",
        })
      ).errors[0].message,
    ).toMatch(/already exists/);
    expect(
      (
        await query(register, {
          email: "admin@example.test",
          password,
          name: "Escalation",
          role: "Admin",
        })
      ).errors[0].message,
    ).toMatch(/only driver and shipper/i);
    expect(
      (
        await query(login, {
          email: "shipper@example.test",
          password: "wrong password",
        })
      ).errors[0].message,
    ).toBe("Invalid email or password");
    expect(
      (
        await query(login, {
          email: "missing@example.test",
          password,
        })
      ).errors[0].message,
    ).toBe("Invalid email or password");
    const stored = await repository.findOneOrFail({
      where: { id: driver.id },
      select: { id: true, email: true, passwordHash: true },
    });
    expect(stored.email).toBe("driver@example.test");
    expect(stored.passwordHash).toMatch(/^scrypt:/);
    expect(stored.passwordHash).not.toContain(password);
    const session = await source
      .getRepository(AuthSession)
      .findOneByOrFail({ userId: driver.id });
    expect(session.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(session.tokenHash).not.toBe(driver.token);
    expect(await query(lookup, { id: user.id }, user.token)).toEqual({
      data: {
        user: { id: user.id, displayName: user.displayName, role: "Shipper" },
      },
    });
    expect(
      (await query(lookup, { id: user.id }, driver.token)).errors[0].message,
    ).toMatch(/own user profile/);
    expect(
      (await query("{ users { id } }", {}, driver.token)).errors[0].message,
    ).toMatch(/admin role/);

    const createTruck =
      'mutation ($kg: Int!) { createTruck(plateNumber: " 01d 123bc ", capacityKg: $kg) { id plateNumber capacityKg } }';
    const truckArgs = { kg: 2400 };
    const truck = (await query(createTruck, truckArgs, driver.token)).data
      .createTruck;
    expect(truck).toMatchObject({ plateNumber: "01D123BC", capacityKg: 2400 });
    expect(
      (await query(createTruck, truckArgs, driver.token)).errors[0].message,
    ).toMatch(/already exists/);
    expect(
      (await query(createTruck, truckArgs, user.token)).errors[0].message,
    ).toMatch(/driver role/);
    expect(
      (await query(createTruck, { kg: 0 }, driver.token)).errors[0].message,
    ).toMatch(/positive integer/);
    expect(
      await query(
        "query ($id: ID!) { truck(id: $id) { id } }",
        { id: truck.id },
        outsider.token,
      ),
    ).toEqual({ data: { truck: null } });

    const origin = { longitude: 69.24, latitude: 41.31 };
    const destination = { longitude: 66.96, latitude: 39.65 };
    const tripInput = {
      origin,
      destination,
      departureAt: "2030-01-01T13:00:00+05:00",
      latestArrivalAt: "2030-01-01T12:00:00Z",
    };
    const createTrip =
      "mutation ($id: ID!, $input: CreateTripInput!) { createTrip(truckId: $id, input: $input) { id departureAt } }";
    const tripArgs = { id: truck.id, input: tripInput };
    const trip = (await query(createTrip, tripArgs, driver.token)).data
      .createTrip;
    expect(trip.departureAt).toBe("2030-01-01T08:00:00.000Z");
    for (const input of [
      { ...tripInput, origin: { longitude: 181, latitude: 41 } },
      { ...tripInput, departureAt: "2030-01-01T08:00:00" },
      { ...tripInput, departureAt: "2030-02-30T08:00:00Z" },
      { ...tripInput, latestArrivalAt: "2030-01-01T07:00:00Z" },
    ]) {
      expect(
        (await query(createTrip, { ...tripArgs, input }, driver.token)).errors,
      ).toHaveLength(1);
    }
    expect(
      (await query(createTrip, { ...tripArgs, id: randomUUID() }, driver.token))
        .errors[0].message,
    ).toMatch(/one of your trucks/);
    expect(
      (await query(createTrip, tripArgs, outsider.token)).errors[0].message,
    ).toMatch(/one of your trucks/);

    const createLoad =
      "mutation ($input: CreateLoadInput!) { createLoad(input: $input) { id shipperId weightKg pickup { coordinates } } }";
    const loadArgs = {
      input: {
        pickup: origin,
        delivery: destination,
        pickupWindowStart: tripInput.departureAt,
        pickupWindowEnd: tripInput.latestArrivalAt,
        weightKg: 500,
      },
    };
    const load = (await query(createLoad, loadArgs, user.token)).data
      .createLoad;
    expect(load).toMatchObject({
      shipperId: user.id,
      weightKg: 500,
      pickup: { coordinates: [origin.longitude, origin.latitude] },
    });
    expect(
      await source.getRepository(Load).findOneByOrFail({ id: load.id }),
    ).toMatchObject({ weightKg: 500 });
    expect(
      (await query(createLoad, loadArgs, driver.token)).errors[0].message,
    ).toMatch(/shipper role/);
    expect(
      (
        await query(
          createLoad,
          {
            ...loadArgs,
            input: { ...loadArgs.input, weightKg: -1 },
          },
          user.token,
        )
      ).errors,
    ).toHaveLength(1);
    const match = await source.getRepository(Match).save({
      tripId: trip.id,
      loadId: load.id,
    });
    const details = await query(
      "query ($load: ID!, $match: ID!) { load(id: $load) { id shipperId weightKg } match(id: $match) { id tripId loadId driverConfirmedAt shipperConfirmedAt isFinal } loads { id } matches { id } }",
      { load: load.id, match: match.id },
      user.token,
    );
    expect(details.data.load).toEqual({
      id: load.id,
      shipperId: user.id,
      weightKg: 500,
    });
    expect(details.data.match).toEqual({
      id: match.id,
      tripId: trip.id,
      loadId: load.id,
      driverConfirmedAt: null,
      shipperConfirmedAt: null,
      isFinal: false,
    });
    expect(details.data.loads).toContainEqual({ id: load.id });
    expect(details.data.matches).toContainEqual({ id: match.id });

    const matchLookup = "query ($id: ID!) { match(id: $id) { isFinal } }";
    expect(await query(matchLookup, { id: match.id }, outsider.token)).toEqual({
      data: { match: null },
    });
    expect(await query("{ matches { id } }", {}, outsider.token)).toEqual({
      data: { matches: [] },
    });
    expect(await query(matchLookup, { id: match.id }, driver.token)).toEqual({
      data: { match: { isFinal: false } },
    });
    const confirmedAt = new Date("2030-01-01T08:00:00Z");
    await source.getRepository(Match).update(match.id, {
      driverConfirmedAt: confirmedAt,
      shipperConfirmedAt: confirmedAt,
    });
    expect(
      await query(
        "query ($id: ID!) { match(id: $id) { isFinal } }",
        {
          id: match.id,
        },
        user.token,
      ),
    ).toEqual({ data: { match: { isFinal: true } } });
    expect(
      await query(
        "query ($id: ID!) { load(id: $id) { id } match(id: $id) { id } }",
        { id: randomUUID() },
        user.token,
      ),
    ).toEqual({ data: { load: null, match: null } });
    expect(
      (await query("{ matches(limit: 0) { id } }", {}, user.token)).errors,
    ).toHaveLength(1);

    const reads = await query(
      "query ($truck: ID!, $trip: ID!) { truck(id: $truck) { id driverId plateNumber capacityKg } trip(id: $trip) { id truckId origin { coordinates } destination { coordinates } } trucks { id } trips { id } }",
      { truck: truck.id, trip: trip.id },
      driver.token,
    );
    expect(reads.data.truck).toEqual({
      id: truck.id,
      driverId: driver.id,
      plateNumber: truck.plateNumber,
      capacityKg: truck.capacityKg,
    });
    expect(reads.data.trip).toEqual({
      id: trip.id,
      truckId: truck.id,
      origin: { coordinates: [origin.longitude, origin.latitude] },
      destination: {
        coordinates: [destination.longitude, destination.latitude],
      },
    });
    expect(reads.data.trucks).toContainEqual({ id: truck.id });
    expect(reads.data.trips).toContainEqual({ id: trip.id });
    expect(
      (await query("{ trucks(offset: -1) { id } }", {}, driver.token)).errors,
    ).toHaveLength(1);
    expect(
      (await query('{ trip(id: "invalid") { id } }', {}, driver.token)).errors,
    ).toHaveLength(1);
    await repository.update(outsider.id, { role: UserRole.Admin });
    const firstPage = await query(
      "{ users(limit: 1) { id } }",
      {},
      outsider.token,
    );
    const nextPage = await query(
      "{ users(limit: 1, offset: 1) { id } }",
      {},
      outsider.token,
    );
    expect(firstPage.data.users).toHaveLength(1);
    expect(nextPage.data.users).toHaveLength(1);
    expect(firstPage.data.users[0].id).not.toBe(nextPage.data.users[0].id);
    expect(
      (await query("{ users(limit: 101) { id } }", {}, outsider.token)).errors,
    ).toHaveLength(1);
    expect(await query(lookup, { id: randomUUID() }, outsider.token)).toEqual({
      data: { user: null },
    });

    expect(await query("mutation { logout }", {}, driver.token)).toEqual({
      data: { logout: true },
    });
    expect(
      (await query("{ trips { id } }", {}, driver.token)).errors[0].message,
    ).toMatch(/valid session/);
    await source
      .getRepository(AuthSession)
      .update({ userId: user.id }, { expiresAt: new Date(0) });
    expect(
      (await query("{ loads { id } }", {}, user.token)).errors[0].message,
    ).toMatch(/valid session/);
    expect(
      (await query(login, { email: "shipper@example.test", password }))
        .errors[0].message,
    ).toMatch(/too many authentication attempts/i);
  } finally {
    if (previousDatabase === undefined) delete process.env.POSTGRES_DB;
    else process.env.POSTGRES_DB = previousDatabase;
    await app?.close();
  }
}, 15000);

test("migrations roll back and reapply cleanly", async () => {
  await source.undoLastMigration();
  const [sessions] = await source.query(
    "SELECT to_regclass('public.auth_sessions') AS table",
  );
  expect(sessions.table).toBeNull();
  expect(await source.query("SELECT id FROM users LIMIT 1")).toHaveLength(1);
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
