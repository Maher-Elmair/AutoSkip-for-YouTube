export const WATCHER_STORAGE_KEY = "watcherEnabled";
export const DEFAULT_WATCHER_STATE = true;
export const LOCAL_STORAGE_NAMESPACE = "autoskip";

/** Usage statistic — stored in chrome.storage.local (frequent writes). */
export const ADS_SKIPPED_KEY = "adsSkipped";
/** Health signal set by the content script when selectors stop matching. */
export const SELECTORS_STALE_KEY = "selectorsMayBeStale";

/** Three-state skip behaviour: off / assist (highlight) / auto (trusted click). */
export const SKIP_MODE_KEY = "skipMode";
export type SkipMode = "off" | "assist" | "auto";
/** "assist" needs no extra permission, so it is the safe first-run default. */
export const DEFAULT_SKIP_MODE: SkipMode = "assist";

/** True once the user has confirmed the Auto-mode explainer dialog (shown once). */
export const SKIP_MODE_AUTO_INTRO_SEEN_KEY = "skipModeAutoIntroSeen";

export const isSkipMode = (value: unknown): value is SkipMode =>
  value === "off" || value === "assist" || value === "auto";

export const STORAGE_KEYS = {
  watcher: WATCHER_STORAGE_KEY,
  adsSkipped: ADS_SKIPPED_KEY,
  selectorsStale: SELECTORS_STALE_KEY,
  skipMode: SKIP_MODE_KEY,
  skipModeAutoIntroSeen: SKIP_MODE_AUTO_INTRO_SEEN_KEY,
} as const;
