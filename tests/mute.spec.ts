import { test, expect } from "@playwright/test";
import path from "node:path";
import { readFile } from "node:fs/promises";

test.use({ channel: "chrome" });

test("ztlumení reklamy nečeká na snímek ani záložní interval", async ({ page }) => {
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
  // Nech bootstrap dokončit asynchronní načítání nastavení.
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
    player.classList.remove("ad-showing");
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    return { normalMuted, adMuted, reasserted, restored: video.muted };
  });
  expect(result).toEqual({ normalMuted: false, adMuted: true, reasserted: true, restored: false });
});
