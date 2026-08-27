export const WATCHER_STORAGE_KEY = "watcherEnabled";
export const DEFAULT_WATCHER_STATE = true;
export const LOCAL_STORAGE_NAMESPACE = "autoskip";

/** Usage statistic — stored in chrome.storage.local (frequent writes). */
export const ADS_SKIPPED_KEY = "adsSkipped";
/** Health signal set by the content script when selectors stop matching. */
export const SELECTORS_STALE_KEY = "selectorsMayBeStale";

export const STORAGE_KEYS = {
  watcher: WATCHER_STORAGE_KEY,
  adsSkipped: ADS_SKIPPED_KEY,
  selectorsStale: SELECTORS_STALE_KEY,
} as const;
