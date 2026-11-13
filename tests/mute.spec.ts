import { test, expect } from "@playwright/test";
import path from "node:path";
import { readFile } from "node:fs/promises";

test.use({ channel: "chrome" });

test("ad muting and audio restoration do not wait for animation frames or the fallback interval", async ({ page }) => {
  await page.goto("https://www.youtube.com/watch?v=aqz-KE-bpKQ", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => {
    const player = document.querySelector("#movie_player");
    const video = player?.querySelector("video");
    return video && (video.readyState > 0 || !!video.currentSrc || !!video.src)
      && !player?.classList.contains("ad-showing")
      && !player?.classList.contains("ad-interrupting");
  });
  await page.evaluate(() => {
    const video = document.querySelector<HTMLVideoElement>("#movie_player video")!;
    video.pause();
    video.muted = false;
    window.requestAnimationFrame = () => 1;
    Object.defineProperty(window, "setInterval", { value: () => 1 });
  });
  await page.evaluate(await readFile(path.resolve("dist/content.js"), "utf8"));
  // Allow bootstrap to finish loading settings asynchronously.
  await page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  const result = await page.evaluate(async () => {
    const player = document.querySelector<HTMLElement>("#movie_player")!;
    const video = player.querySelector("video")!;
    const normalMuted = video.muted;
    player.classList.add("ad-showing");
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    const adMuted = video.muted;
    video.muted = false;
    video.dispatchEvent(new Event("volumechange"));
    const reasserted = video.muted;
    // An empty ad container can remain visible during regular video playback.
    const module = document.createElement("div");
    module.className = "ytp-ad-module video-ads";
    module.style.cssText = "display: block !important; visibility: visible !important; opacity: 1 !important; width: 100px; height: 100px";
    player.append(module);
    player.classList.remove("ad-showing");
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    const restored = video.muted;
    const badge = document.createElement("div");
    badge.className = "ytp-ad-badge";
    badge.style.cssText = "display: block; visibility: visible; opacity: 1; width: 50px; height: 20px";
    module.append(badge);
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    const badgeMuted = video.muted;
    badge.style.display = "none";
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    const hiddenRestored = video.muted;
    badge.style.display = "block";
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    const shownMuted = video.muted;
    player.classList.add("ad-interrupting");
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    const interruptingMuted = video.muted;
    player.classList.remove("ad-interrupting");
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    const staleBadgeRestored = video.muted;
    badge.remove();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    const removedRestored = video.muted;
    module.remove();
    return { normalMuted, adMuted, reasserted, restored, badgeMuted, hiddenRestored, shownMuted, interruptingMuted, staleBadgeRestored, removedRestored };
  });
  expect(result).toEqual({ normalMuted: false, adMuted: true, reasserted: true, restored: false,
    badgeMuted: false, hiddenRestored: false, shownMuted: false,
    interruptingMuted: true, staleBadgeRestored: false, removedRestored: false });
});
