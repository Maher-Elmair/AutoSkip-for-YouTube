import { errors, type Page } from "@playwright/test";
import { AD_CLASS_NAMES, AD_SKIP_SELECTORS, PLAYER_SELECTOR } from "../../src/extension/shared/skipSelectors";

export async function checkLiveSkipControl(
  page: Page,
  selectors: readonly string[] = AD_SKIP_SELECTORS,
  timeout = 45000,
) {
  let observation;
  try {
    const handle = await page.waitForFunction(({ playerSelector, skipSelectors, adClasses }) => {
      const player = document.querySelector(playerSelector);
      if (!player) return null;
      // Discover the control by its English accessible label, independently of
      // the production class selectors whose compatibility is being checked.
      const button = Array.from(player.querySelectorAll<HTMLElement>('button, [role="button"]')).find((element) => {
        const label = (element.getAttribute("aria-label") || element.textContent || "").replace(/\s+/g, " ").trim();
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return /^skip(?:\s+(?:ad|ads|advertisement))?$/i.test(label)
          && !element.hasAttribute("disabled") && element.getAttribute("aria-disabled") !== "true"
          && style.display !== "none" && style.visibility !== "hidden"
          && Number(style.opacity) > 0.1 && style.pointerEvents !== "none"
          && rect.width > 0 && rect.height > 0;
      });
      if (!button) return null;
      const matches = skipSelectors.filter((selector) => Array.from(player.querySelectorAll(selector)).some((candidate) =>
        (candidate.closest('button, [role="button"]') ?? candidate) === button,
      ));
      return { html: button.outerHTML, matches, playerClasses: player.className,
        adClassDetected: adClasses.some((name) => player.classList.contains(name)) };
    }, { playerSelector: PLAYER_SELECTOR, skipSelectors: [...selectors], adClasses: [...AD_CLASS_NAMES] }, { timeout });
    observation = await handle.jsonValue();
    await handle.dispose();
  } catch (error) {
    if (!(error instanceof errors.TimeoutError)) throw error;
    throw new Error("INCONCLUSIVE: no visible enabled Skip control was observed. Ad selectors were NOT verified; ads may be unavailable, consent may be required, or YouTube may have changed.", { cause: error });
  }
  if (!observation?.matches.length) {
    throw new Error(`YouTube Skip control is not matched by AD_SKIP_SELECTORS: ${JSON.stringify(observation)}`);
  }
  if (!observation.adClassDetected) {
    throw new Error(`YouTube Skip control is present but the ad classes used for muting are missing: ${JSON.stringify(observation)}`);
  }
  return observation;
}
