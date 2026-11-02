import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "i18n.spec.ts",
  timeout: 30000,
  retries: 0,
  reporter: [["list"]],
  use: {
    channel: "chromium",
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 384, height: 600 },
    locale: "en-US",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
