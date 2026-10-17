import { defineConfig } from "vitest/config";

// Separate from vite.config.ts so the React Router plugin (which blocks
// `.server` imports outside the app build) is not loaded during tests.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["app/**/*.test.ts"],
  },
});
