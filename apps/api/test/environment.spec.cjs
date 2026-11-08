const { test, expect } = require("@jest/globals");
const { validateEnvironment } = require("../dist/config/environment");

test("missing API settings use local defaults", () => {
  expect(validateEnvironment({})).toEqual({
    API_HOST: "127.0.0.1",
    API_PORT: 3000,
  });
});

test.each(["1", "3001", "65535"])("accepts valid port %s", (port) => {
  expect(validateEnvironment({ API_PORT: port }).API_PORT).toBe(Number(port));
});

test.each(["0", "65536", "-1", "3.5", "3e3", "3000abc", "", " 3000 "])(
  "rejects invalid port %j",
  (port) => {
    expect(() => validateEnvironment({ API_PORT: port })).toThrow("API_PORT");
  },
);

test.each(["0.0.0.0", "::1"])("accepts IP address %s", (host) => {
  expect(validateEnvironment({ API_HOST: host }).API_HOST).toBe(host);
});

test.each(["", "localhost", "127.0.0.999", "http://127.0.0.1"])(
  "rejects invalid host %j",
  (host) => {
    expect(() => validateEnvironment({ API_HOST: host })).toThrow("API_HOST");
  },
);

test("preserves settings used by other modules", () => {
  expect(validateEnvironment({ OTHER_SETTING: "example" })).toMatchObject({
    OTHER_SETTING: "example",
  });
});
