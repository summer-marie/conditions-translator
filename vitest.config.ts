import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["tests/setup/loadEnv.ts"],
    // DB integration tests (tests/schema) can be slower than the pooled-connection default.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
