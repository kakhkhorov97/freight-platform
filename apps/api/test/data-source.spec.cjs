const { test, expect } = require("@jest/globals");
const { spawnSync } = require("node:child_process");
const { dirname, resolve } = require("node:path");
const process = require("node:process");
const apiDirectory = dirname(require.resolve("../package.json"));

test("CLI data source loads without connecting and honors shell settings", () => {
  const script = `
    const source = require('./dist/database/data-source').default;
    process.stdout.write(JSON.stringify({
      initialized: source.isInitialized,
      port: source.options.port,
      database: source.options.database,
      migrations: source.options.migrations,
      synchronize: source.options.synchronize,
      migrationsRun: source.options.migrationsRun,
    }));
  `;
  const result = spawnSync(process.execPath, ["-e", script], {
    cwd: apiDirectory,
    env: {
      ...process.env,
      POSTGRES_HOST: "127.0.0.1",
      POSTGRES_PORT: "5439",
      POSTGRES_DB: "migration-test",
      POSTGRES_USER: "test-user",
      POSTGRES_PASSWORD: "test-password",
    },
    encoding: "utf8",
    timeout: 5000,
  });
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  expect(JSON.parse(result.stdout)).toEqual({
    initialized: false,
    port: 5439,
    database: "migration-test",
    migrations: [resolve(apiDirectory, "dist/database/migrations/*.js")],
    synchronize: false,
    migrationsRun: false,
  });
});
