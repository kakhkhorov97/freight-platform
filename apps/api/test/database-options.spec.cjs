const { test, expect } = require("@jest/globals");
const { createDatabaseOptions } = require("../dist/database/database-options");
const fixture = { POSTGRES_PASSWORD: "test-password" };

test("uses local defaults and disables automatic database changes", () => {
  expect(createDatabaseOptions(fixture)).toMatchObject({
    host: "127.0.0.1",
    port: 5432,
    username: "freight",
    database: "freight",
    synchronize: false,
    dropSchema: false,
    migrationsRun: false,
    installExtensions: false,
    extra: { options: "-c timezone=UTC" },
  });
});

test("uses configured database connection settings", () => {
  expect(
    createDatabaseOptions({
      ...fixture,
      POSTGRES_HOST: "postgres",
      POSTGRES_PORT: "5433",
      POSTGRES_DB: "test-db",
      POSTGRES_USER: "test-user",
    }),
  ).toMatchObject({
    host: "postgres",
    port: 5433,
    database: "test-db",
    username: "test-user",
  });
});

test.each(["0", "65536", "3.5", "5432abc", ""])(
  "rejects invalid port %j",
  (port) => {
    expect(() =>
      createDatabaseOptions({ ...fixture, POSTGRES_PORT: port }),
    ).toThrow("POSTGRES_PORT");
  },
);

test.each([
  "POSTGRES_HOST",
  "POSTGRES_DB",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
])("rejects blank %s", (key) => {
  expect(() => createDatabaseOptions({ ...fixture, [key]: " " })).toThrow(key);
});

test("requires a password without echoing its value", () => {
  expect(() => createDatabaseOptions({})).toThrow(
    "POSTGRES_PASSWORD must be a non-empty string",
  );
});

test("rejects a URL supplied as the host", () => {
  expect(() =>
    createDatabaseOptions({
      ...fixture,
      POSTGRES_HOST: "postgres://localhost",
    }),
  ).toThrow("POSTGRES_HOST");
});
