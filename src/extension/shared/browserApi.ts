export type ChromeLike = typeof chrome;

/**
 * Single shared resolver for the browser extension API.
 * Works on Chrome/Edge/Brave/Opera (`chrome`) and Firefox (`browser`).
 */
export const resolveBrowserApi = (): ChromeLike | undefined => {
  if (typeof chrome !== "undefined" && chrome.storage?.sync) {
    return chrome;
  }

  if (typeof browser !== "undefined" && browser?.storage?.sync) {
    return browser as unknown as ChromeLike;
  }

  return undefined;
};
