import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testIgnore: "**/i18n.spec.ts",
  timeout: 120000,
  retries: 1,
  reporter: [["list"]],
  workers: 1,
});
