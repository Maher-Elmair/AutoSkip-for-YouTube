/** Live YouTube checks run separately from the extension build. */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkLiveSkipControl } from "./helpers/selectorHealth";
import {
  AD_SKIP_SELECTORS, AD_INDICATOR_SELECTORS, BLUR_OVERLAY_ID,
  FALLBACK_SKIP_SELECTORS, OVERLAY_CLOSE_SELECTORS, PLAYER_SELECTOR, SURVEY_SKIP_SELECTORS,
} from "../src/extension/shared/skipSelectors";

const here = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(here, "../dist");
const SAMPLE_VIDEO = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";

test("all production selectors have valid CSS syntax", async ({ page }) => {
  const invalid = await page.evaluate((selectors) => selectors.filter((selector) => {
    try { document.querySelectorAll(selector); return false; } catch { return true; }
  }), [...AD_SKIP_SELECTORS, ...SURVEY_SKIP_SELECTORS, ...OVERLAY_CLOSE_SELECTORS,
    ...FALLBACK_SKIP_SELECTORS, ...AD_INDICATOR_SELECTORS]);
  expect(invalid).toEqual([]);
});

test("live YouTube ad controls match selectors and activate the extension", async ({ playwright }, testInfo) => {
  test.setTimeout(120000);
  const context = await playwright.chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: false,
    locale: "en-US",
    args: [`--disable-extensions-except=${distPath}`, `--load-extension=${distPath}`, "--mute-audio"],
  });
  const page = await context.newPage();
  const logs: string[] = [];
  page.on("console", (message) => logs.push(message.text()));
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    // Wait for the startup default write so it cannot overwrite the test settings.
    await expect.poll(() => worker.evaluate("chrome.storage.sync.get(['blurAds']).then((result) => result.blurAds !== undefined)"),
      { message: "Background default settings must be initialized" }).toBe(true);
    // Keep the real skip control available for observation instead of auto-clicking it.
    await worker.evaluate("chrome.storage.sync.set({ watcherEnabled: true, skipMode: 'off', muteAdSound: true, blurAds: true })");
    await page.goto(SAMPLE_VIDEO, { waitUntil: "domcontentloaded" });
    const consent = page.getByRole("button", { name: /^(Reject all|Accept all)$/i });
    await consent.first().waitFor({ timeout: 5000 }).catch(() => undefined);
    if (await consent.first().isVisible()) await consent.first().click();
    await expect(page.locator(PLAYER_SELECTOR)).toBeVisible({ timeout: 30000 });
    await expect.poll(() => logs.some((line) => line.includes("[autoskip]") && line.includes("Started watching for ads")),
      { message: "The extension content script must actually start" }).toBe(true);
    // A real user gesture also avoids mistaking blocked autoplay for broken selectors.
    const play = page.getByRole("button", { name: /^Play(?: \(k\))?$/ });
    if (await play.first().isVisible()) await play.first().click();
    const observation = await checkLiveSkipControl(page);
    await testInfo.attach("observed-skip-control", { body: JSON.stringify(observation, null, 2), contentType: "application/json" });
    const overlay = page.locator(`#${BLUR_OVERLAY_ID}`);
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveCSS("pointer-events", "none");
    const video = page.locator(`${PLAYER_SELECTOR} video`).first();
    await expect(video).toBeAttached();
    await expect(video).toHaveCSS("filter", "none");
    expect(logs.filter((line) => line.includes("[autoskip]") && /failed/i.test(line))).toEqual([]);
  } catch (error) {
    await testInfo.attach("youtube-page", { body: await page.screenshot(), contentType: "image/png" });
    await testInfo.attach("youtube-dom", { body: await page.content(), contentType: "text/html" });
    throw error;
  } finally {
    await testInfo.attach("youtube-console", { body: logs.join("\n"), contentType: "text/plain" });
    await context.close();
  }
});
