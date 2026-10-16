import { defineConfig, devices } from "@playwright/test";

const launchOptions = {
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
};

export default defineConfig({
  testDir: "e2e",
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: "http://localhost:4173", trace: "on-first-retry" },
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { VITE_NARRATION_MODE: "replay" },
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /mobile\.spec/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        launchOptions,
      },
    },
    {
      name: "mobile",
      testMatch: /mobile\.spec/,
      use: { ...devices["Pixel 7"], launchOptions },
    },
  ],
});
