import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3200",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node scripts/fixture-api.mjs",
      url: "http://127.0.0.1:3201/healthz",
      reuseExistingServer: false,
    },
    {
      command: "npm run start -- --port 3200",
      url: "http://127.0.0.1:3200",
      reuseExistingServer: false,
      env: {
        UNSTUCK_API_URL: "http://127.0.0.1:3201/api/v1",
        UNSTUCK_MEDIA_ORIGIN: "",
      },
    },
  ],
});
