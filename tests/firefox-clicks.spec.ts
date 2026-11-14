import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

test.beforeEach(async ({ page }) => {
  // Isolate event ordering from YouTube network and ad availability.
  await page.route("https://www.youtube.com/watch?v=aqz-KE-bpKQ", (route) =>
    route.fulfill({ contentType: "text/html", body:
      '<html><body><div id="movie_player" class="ad-showing"><video src="data:video/mp4;base64,"></video></div></body></html>' }),
  );
  await page.goto("https://www.youtube.com/watch?v=aqz-KE-bpKQ");
  await page.evaluate(() => {
    let debuggerRequests = 0;
    Object.defineProperty(window, "debuggerRequests", { get: () => debuggerRequests });
    window.requestAnimationFrame = () => 1;
    Object.defineProperty(window, "setInterval", { value: () => 1 });
    Object.defineProperty(window, "browser", { value: {
      storage: { sync: { get: async () => ({ watcherEnabled: true, skipMode: "auto" }) } },
      runtime: {
        getBrowserInfo: async () => ({ name: "Firefox" }),
        sendMessage: () => { debuggerRequests++; throw new Error("Firefox must not request a debugger click"); },
      },
    } });
  });
  await page.evaluate(await readFile(path.resolve("dist/content.js"), "utf8"));
  await page.evaluate(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
});

test("Firefox click path handles consecutive ads and a re-enabled skip button", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const player = document.querySelector("#movie_player")!;
    const clicks: string[] = [];
    const events: string[] = [];
    const createButton = (name: string) => {
      const button = document.createElement("button");
      button.className = "ytp-ad-skip-button";
      button.textContent = name;
      let pointerPressed = false;
      let pointerReleased = false;
      button.addEventListener("pointerdown", () => { pointerPressed = true; });
      button.addEventListener("pointerup", () => { pointerReleased = pointerPressed; });
      button.addEventListener("click", (event) => {
        if (pointerReleased && event.detail === 1 && event.pointerId === 1) {
          clicks.push(name);
          button.remove();
        }
      });
      for (const type of ["pointerover", "mouseover", "pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
        button.addEventListener(type, () => events.push(`${name}:${type}`));
      }
      return button;
    };
    const flush = async () => {
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      await new Promise<void>((resolve) => queueMicrotask(resolve));
    };
    const first = createButton("first");
    player.append(first);
    await flush();
    const second = createButton("second");
    second.setAttribute("aria-disabled", "true");
    player.append(second);
    await flush();
    const beforeEnabled = [...clicks];
    second.setAttribute("aria-disabled", "false");
    await flush();
    return { beforeEnabled, clicks, events };
  });
  expect(result.beforeEnabled).toEqual(["first"]);
  expect(await page.evaluate("window.debuggerRequests")).toBe(0);
  expect(result.clicks).toEqual(["first", "second"]);
  expect(result.events).toEqual(["first", "second"].flatMap((name) =>
    ["pointerover", "mouseover", "pointerdown", "mousedown", "pointerup", "mouseup", "click"].map((type) => `${name}:${type}`),
  ));
});

test("Firefox targets the hit-tested child and bubbles to the skip button", async ({ page }) => {
  await page.evaluate(() => {
    const button = document.createElement("button");
    button.className = "ytp-ad-skip-button";
    button.style.cssText = "padding: 0; border: 0";
    const label = document.createElement("span");
    label.textContent = "Skip";
    label.style.cssText = "display: block; width: 100px; height: 40px";
    label.addEventListener("click", () => button.dataset.childClicked = "true");
    button.addEventListener("click", (event) => {
      button.dataset.bubbled = String(event.target === label);
    });
    button.append(label);
    document.querySelector("#movie_player")!.append(button);
  });
  const button = page.getByRole("button", { name: "Skip", exact: true });
  await expect(button).toHaveAttribute("data-child-clicked", "true");
  await expect(button).toHaveAttribute("data-bubbled", "true");
});

test("Firefox highlights a rejected skip and stops retrying until the user clicks", async ({ page }) => {
  await page.evaluate(() => {
    const player = document.querySelector("#movie_player")!;
    const button = document.createElement("button");
    button.className = "ytp-ad-skip-button";
    button.textContent = "Skip";
    button.dataset.syntheticClicks = "0";
    button.addEventListener("click", (event) => {
      if (event.isTrusted) {
        button.remove();
        player.classList.remove("ad-showing");
      } else {
        button.dataset.syntheticClicks = String(Number(button.dataset.syntheticClicks) + 1);
      }
    });
    player.append(button);
  });
  const button = page.getByRole("button", { name: "Skip", exact: true });
  const ring = page.locator("#autoskip-highlight-ring");
  await expect(ring).toBeVisible();
  await expect(button).toHaveAttribute("data-synthetic-clicks", "1");
  await expect(ring).toHaveCSS("pointer-events", "none");

  // Trigger fresh ticks beyond the normal click cooldown without real waiting.
  await page.evaluate(async () => {
    const now = Date.now();
    Date.now = () => now + 5000;
    const player = document.querySelector<HTMLElement>("#movie_player")!;
    for (let index = 0; index < 3; index++) {
      player.classList.toggle("test-controls-visible");
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      await new Promise<void>((resolve) => queueMicrotask(resolve));
    }
  });
  await expect(button).toHaveAttribute("data-synthetic-clicks", "1");
  await expect(ring).toBeVisible();
  await button.click();
  await expect(button).toHaveCount(0);
  await expect(ring).toBeHidden();
  expect(await page.locator("video").evaluate((video: HTMLVideoElement) => video.muted)).toBe(false);
});
