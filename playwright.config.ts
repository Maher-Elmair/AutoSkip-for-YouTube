import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 120000,
  retries: 1,
  reporter: [["list"]],
  workers: 1,
});
