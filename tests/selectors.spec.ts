/**
 * Selector-health tests. These run against the real YouTube DOM and are
 * intentionally isolated from the main build: a YouTube redesign should make
 * this suite fail loudly (so the selectors get updated) without ever breaking
 * the extension build itself.
 *
 * Run: npx playwright test (from extension/)
 */
import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SKIP_BUTTON_SELECTORS,
  AD_INDICATOR_SELECTORS,
  BLUR_OVERLAY_ID,
  PLAYER_SELECTOR,
} from "../src/extension/shared/skipSelectors";

const here = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(here, "../dist");
const SAMPLE_VIDEO = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";

async function launchWithExtension(): Promise<BrowserContext> {
  return chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--disable-extensions-except=${distPath}`,
      `--load-extension=${distPath}`,
      "--mute-audio",
    ],
  });
}

test("the unpacked extension loads and injects the content script", async () => {
  const context = await launchWithExtension();
  const page = await context.newPage();
  const logs: string[] = [];
  page.on("console", (msg) => logs.push(msg.text()));

  await page.goto(SAMPLE_VIDEO, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(PLAYER_SELECTOR, { timeout: 30000 });

  expect(logs.filter((l) => l.includes("Failed to initialize"))).toHaveLength(0);
  await context.close();
});

test("known skip / ad selectors are still valid CSS and queryable", async () => {
  const context = await launchWithExtension();
  const page = await context.newPage();
  await page.goto(SAMPLE_VIDEO, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(PLAYER_SELECTOR, { timeout: 30000 });

  const invalid = await page.evaluate(
    (selectors: string[]) =>
      selectors.filter((selector) => {
        try {
          document.querySelectorAll(selector);
          return false;
        } catch {
          return true;
        }
      }),
    [...SKIP_BUTTON_SELECTORS, ...AD_INDICATOR_SELECTORS]
  );

  expect(invalid, `Invalid selectors: ${invalid.join(", ")}`).toEqual([]);
  await context.close();
});

test("the blur overlay never touches the <video> element", async () => {
  const context = await launchWithExtension();
  const page = await context.newPage();
  await page.goto(SAMPLE_VIDEO, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(PLAYER_SELECTOR, { timeout: 30000 });

  const videoFilter = await page.evaluate(() => {
    const video = document.querySelector("video.html5-main-video");
    return video ? getComputedStyle(video).filter : "none";
  });
  expect(videoFilter === "none" || videoFilter === "").toBeTruthy();

  const overlayPointerEvents = await page.evaluate((id: string) => {
    const overlay = document.getElementById(id);
    return overlay ? getComputedStyle(overlay).pointerEvents : "none";
  }, BLUR_OVERLAY_ID);
  expect(overlayPointerEvents).toBe("none");

  await context.close();
});
