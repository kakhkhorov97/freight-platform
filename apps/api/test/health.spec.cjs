require("reflect-metadata");
const { beforeAll, afterAll, test, expect } = require("@jest/globals");
const { NestFactory } = require("@nestjs/core");
const { Module } = require("@nestjs/common");
const { HealthController } = require("../dist/health/health.controller");

// Controller HTTP tests run independently of database availability.
class HealthTestModule {}
Module({ controllers: [HealthController] })(HealthTestModule);

let app;
let baseUrl;

beforeAll(async () => {
  app = await NestFactory.create(HealthTestModule, { logger: false });
  await app.listen(0, "127.0.0.1");
  baseUrl = await app.getUrl();
});

afterAll(async () => {
  await app?.close();
});

test("GET /health returns HTTP 200 with the API liveness status", async () => {
  const response = await globalThis.fetch(`${baseUrl}/health`);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(await response.json()).toEqual({ status: "ok" });
});

test("unknown routes return HTTP 404", async () => {
  const response = await globalThis.fetch(`${baseUrl}/missing`);
  expect(response.status).toBe(404);
});
