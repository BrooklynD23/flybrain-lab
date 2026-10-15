import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: [
      "src/**/*.test.{ts,tsx}",
      "functions/**/*.test.ts",
      "scripts/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      include: ["src/**", "functions/**"],
      exclude: ["src/scene/*.tsx", "src/main.tsx", "**/*.test.*"],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
