import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests — ต้องมี api (:4000) + web (:3000) รันอยู่ และ seed ด้วย apps/api/prisma/seed-e2e.ts แล้ว
 *   npx playwright test -c e2e
 * เปลี่ยน URL ได้ด้วย E2E_BASE_URL
 */
export default defineConfig({
  testDir: ".",
  timeout: 90_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } } : {}),
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
