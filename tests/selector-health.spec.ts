import { test, expect } from "@playwright/test";
import { checkLiveSkipControl } from "./helpers/selectorHealth";

test("selector health checks require a matching real control", async ({ page }) => {
  await page.setContent('<div id="movie_player" class="ad-showing"><button class="ytp-skip-ad-button">Skip</button></div>');
  expect((await checkLiveSkipControl(page, undefined, 1000)).matches).toContain(".ytp-skip-ad-button");
});

test("selector health checks reject renamed skip controls", async ({ page }) => {
  await page.setContent('<div id="movie_player" class="ad-showing"><button class="new-youtube-skip">Skip</button></div>');
  await expect(checkLiveSkipControl(page, undefined, 1000)).rejects.toThrow("not matched by AD_SKIP_SELECTORS");
});

test("selector health checks reject renamed ad state classes", async ({ page }) => {
  await page.setContent('<div id="movie_player" class="new-ad-state"><button class="ytp-skip-ad-button">Skip</button></div>');
  await expect(checkLiveSkipControl(page, undefined, 1000)).rejects.toThrow("ad classes used for muting are missing");
});

test("a run without a skippable ad cannot report healthy selectors", async ({ page }) => {
  await page.setContent('<div id="movie_player"><button>Skip intro</button><button style="display:none">Skip</button></div>');
  await expect(checkLiveSkipControl(page, undefined, 250)).rejects.toThrow("INCONCLUSIVE");
});
