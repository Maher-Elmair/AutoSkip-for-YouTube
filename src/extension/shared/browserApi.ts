export type ChromeLike = typeof chrome;

/**
 * Single shared resolver for the browser extension API.
 * Works on Chrome/Edge/Brave/Opera (`chrome`) and Firefox (`browser`).
 */
export const resolveBrowserApi = (): ChromeLike | undefined => {
  // Firefox also exposes chrome.*, but browser.* provides promise-based APIs.
  if (typeof browser !== "undefined" && browser?.storage?.sync) {
    return browser as unknown as ChromeLike;
  }

  if (typeof chrome !== "undefined" && chrome.storage?.sync) {
    return chrome;
  }

  return undefined;
};
