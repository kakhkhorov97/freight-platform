import { isIP } from "node:net";
import { resolve } from "node:path";
import type { DataSourceOptions } from "typeorm";

function requiredText(value: unknown, key: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value;
}

export function createDatabaseOptions(
  input: Record<string, unknown>,
): DataSourceOptions {
  const host = requiredText(
    input.POSTGRES_HOST ?? "127.0.0.1",
    "POSTGRES_HOST",
  );
  if (
    isIP(host) === 0 &&
    !/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(host)
  ) {
    throw new Error("POSTGRES_HOST must be an IP address or hostname");
  }
  const rawPort = input.POSTGRES_PORT ?? "5432";
  if (
    typeof rawPort !== "string" ||
    !/^\d+$/.test(rawPort) ||
    Number(rawPort) < 1 ||
    Number(rawPort) > 65535
  ) {
    throw new Error("POSTGRES_PORT must be a whole number from 1 to 65535");
  }
  return {
    type: "postgres",
    host,
    port: Number(rawPort),
    username: requiredText(input.POSTGRES_USER ?? "freight", "POSTGRES_USER"),
    database: requiredText(input.POSTGRES_DB ?? "freight", "POSTGRES_DB"),
    password: requiredText(input.POSTGRES_PASSWORD, "POSTGRES_PASSWORD"),
    synchronize: false,
    dropSchema: false,
    migrationsRun: false,
    installExtensions: false,
    entities: [],
    migrations: [resolve(__dirname, "migrations/*.js")],
    connectTimeoutMS: 5000,
    extra: { options: "-c timezone=UTC" },
  };
}
