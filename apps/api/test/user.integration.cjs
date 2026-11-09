require("reflect-metadata");
const { beforeAll, afterAll, test, expect } = require("@jest/globals");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");
const { DataSource } = require("typeorm");
const { User, UserRole } = require("../dist/users/user.entity");
const { Truck } = require("../dist/trucks/truck.entity");
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

test("migrations roll back and reapply cleanly", async () => {
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
