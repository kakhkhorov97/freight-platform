import "reflect-metadata";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { DataSource } from "typeorm";
import { createDatabaseOptions } from "./database-options";

const envPath = resolve(__dirname, "../../../../.env");
const fileSettings = existsSync(envPath)
  ? parseEnv(readFileSync(envPath, "utf8"))
  : {};

export default new DataSource(
  createDatabaseOptions({ ...fileSettings, ...process.env }),
);
