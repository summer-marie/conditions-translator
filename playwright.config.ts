/**
 * Playwright configuration for browser-driven regression tests.
 *
 * Separate from `vitest.config.ts` on purpose: these tests drive a real Chromium instance
 * against a real running Next.js dev server (see `webServer` below), which Vitest's node/jsdom
 * environment cannot do. Test files use the `.pw.ts` suffix (not `.spec.ts`/`.test.ts`) so
 * Vitest's default include glob never picks them up.
 *
 * @module playwright.config
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.pw.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      // Default project: every *.pw.ts file except ones explicitly scoped to desktop below,
      // so existing mobile-only specs (e.g. mobile-chat-overflow.pw.ts) keep running exactly
      // as before — unaffected by the new desktop-chrome project.
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 5"],
      },
      testIgnore: "**/*.desktop.pw.ts",
    },
    {
      // Desktop-scoped specs only (naming convention: *.desktop.pw.ts), for UI that's
      // intentionally different at the md+ breakpoint (e.g. the chat disclaimer banner).
      name: "desktop-chrome",
      use: {
        ...devices["Desktop Chrome"],
      },
      testMatch: "**/*.desktop.pw.ts",
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
