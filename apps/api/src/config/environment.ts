import { isIP } from "node:net";

export interface ApiEnvironment {
  API_HOST: string;
  API_PORT: number;
}

export function validateEnvironment(
  input: Record<string, unknown>,
): ApiEnvironment {
  const host = input.API_HOST ?? "127.0.0.1";
  if (typeof host !== "string" || isIP(host) === 0) {
    throw new Error("API_HOST must be a valid IPv4 or IPv6 address");
  }

  const rawPort = input.API_PORT ?? "3000";
  if (typeof rawPort !== "string" || !/^\d+$/.test(rawPort)) {
    throw new Error("API_PORT must be a whole number from 1 to 65535");
  }
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("API_PORT must be a whole number from 1 to 65535");
  }

  return { ...input, API_HOST: host, API_PORT: port };
}
