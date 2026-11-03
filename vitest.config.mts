import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    pool: "forks",
    env: { TZ: "UTC", APP_ENCRYPTION_KEY: "test-key-0123456789-0123456789-abcdef", APP_URL: "http://localhost:3000" },
  },
});
