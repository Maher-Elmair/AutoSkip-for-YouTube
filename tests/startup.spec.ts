import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

test.use({ channel: "chrome" });

for (const settings of [
  { watcherEnabled: true, muteAdSound: true },
  { watcherEnabled: false, muteAdSound: true },
  { watcherEnabled: true, muteAdSound: false },
]) {
  test(`startup respects delayed settings ${JSON.stringify(settings)}`, async ({ page }) => {
    const content = await readFile(path.resolve("dist/content.js"), "utf8");
    // A controlled document is needed to test document_start before any video loads.
    await page.route("https://www.youtube.com/watch?v=aqz-KE-bpKQ", (route) =>
      route.fulfill({ contentType: "text/html", body:
        '<html><body><div id="movie_player" class="ad-showing"><video class="html5-main-video"></video></div></body></html>' }),
    );
    await page.addInitScript({ content: `
      window.requestAnimationFrame = () => 1;
      window.setInterval = () => 1;
      window.settingsReads = 0;
      Object.defineProperty(window, "chrome", { value: { storage: { sync: {
        get: () => {
          window.settingsReads++;
          return new Promise(resolve => {
            window.releaseSettings = () => resolve(${JSON.stringify(settings)});
          });
        }
      } } } });
      ${content}
    ` });
    await page.goto("https://www.youtube.com/watch?v=aqz-KE-bpKQ");
    expect(await page.locator("video").evaluate((video: HTMLVideoElement) => ({
      muted: video.muted, readyState: video.readyState, src: video.currentSrc,
    }))).toEqual({ muted: false, readyState: 0, src: "" });
    expect(await page.evaluate("window.settingsReads")).toBe(1);
    await page.evaluate("window.releaseSettings()");
    await page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
    const shouldMute = settings.watcherEnabled && settings.muteAdSound;
    expect(await page.locator("video").evaluate((video: HTMLVideoElement) => video.muted)).toBe(shouldMute);

    const result = await page.evaluate(async () => {
      const player = document.querySelector("#movie_player")!;
      const original = player.querySelector("video")!;
      const replacement = document.createElement("video");
      original.replaceWith(replacement);
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      const replacementMuted = replacement.muted;
      const originalRestored = !original.muted;
      // Cancel loading while the ad is still active.
      replacement.remove();
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      const detachedRestored = !replacement.muted;
      player.classList.remove("ad-showing");
      original.muted = true;
      player.append(original);
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      player.classList.add("ad-showing");
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      player.classList.remove("ad-showing");
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      return { replacementMuted, originalRestored, detachedRestored, userMutePreserved: original.muted };
    });
    expect(result).toEqual({ replacementMuted: shouldMute, originalRestored: true,
      detachedRestored: true, userMutePreserved: true });
  });
}
