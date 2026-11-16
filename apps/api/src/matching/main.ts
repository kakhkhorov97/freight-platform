import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { createMatchingWorker } from "./matching-queue";
import { createRedisOptions } from "./redis-options";

async function main(): Promise<void> {
  const envPath = resolve(__dirname, "../../../../.env");
  const fileSettings = existsSync(envPath)
    ? parseEnv(readFileSync(envPath, "utf8"))
    : {};
  const connection = createRedisOptions({ ...fileSettings, ...process.env });
  const worker = createMatchingWorker(connection, (error) =>
    console.error(`Matching worker connection error: ${error.message}`),
  );
  worker.on("failed", (job, error) => {
    console.error(
      `Matching job ${job?.id ?? "unknown"} failed: ${error.message}`,
    );
  });
  let closing = false;
  const close = (): void => {
    if (closing) return;
    closing = true;
    void worker.close().catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
  await worker.waitUntilReady();
  if (!closing) console.log("Matching worker is ready");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
