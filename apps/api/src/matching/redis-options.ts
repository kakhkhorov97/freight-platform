import { isIP } from "node:net";

export function createRedisOptions(input: Record<string, unknown>) {
  const host = input.REDIS_HOST ?? "127.0.0.1";
  const rawPort = input.REDIS_PORT ?? "6379";
  if (typeof host !== "string" || (host !== "localhost" && isIP(host) === 0)) {
    throw new Error("REDIS_HOST must be localhost or an IP address");
  }
  if (
    typeof rawPort !== "string" ||
    !/^\d+$/.test(rawPort) ||
    Number(rawPort) < 1 ||
    Number(rawPort) > 65535
  ) {
    throw new Error("REDIS_PORT must be a whole number from 1 to 65535");
  }
  return { host, port: Number(rawPort), connectTimeout: 5000 };
}
