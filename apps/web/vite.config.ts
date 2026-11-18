import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// Read API_HOST and API_PORT from the root .env so the dev proxy follows the API.
const rootDir = resolve(import.meta.dirname, "../..");

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, rootDir, "API_"), ...process.env };
  const apiHost = env.API_HOST ?? "127.0.0.1";
  const apiPort = env.API_PORT ?? "3000";
  const hostPart = apiHost.includes(":") ? `[${apiHost}]` : apiHost;
  const apiTarget = `http://${hostPart}:${apiPort}`;

  return {
    plugins: [react()],
    envDir: rootDir,
    // Only WEB_-prefixed variables reach browser code; never expose secrets.
    envPrefix: "WEB_",
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      proxy: {
        "/graphql": apiTarget,
        "/health": apiTarget,
      },
    },
  };
});
