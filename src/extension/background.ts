import {
  ADS_SKIPPED_KEY,
  DEFAULT_WATCHER_STATE,
  WATCHER_STORAGE_KEY,
} from "@/constants/storage";
import { resolveBrowserApi } from "./shared/browserApi";
import { logDebug, logWarn } from "./shared/logger";

const api = resolveBrowserApi();

// Throttle storage writes to avoid sync quota issues.
let lastWriteTime = 0;
let WRITE_THROTTLE_MS = 1000;

/** Settings live in sync; the counter lives in local. */
const ensureDefaults = () => {
  if (!api?.storage?.sync) {
    logWarn("Background: storage API not available");
    return;
  }

  try {
    api.storage.sync.get(
      [WATCHER_STORAGE_KEY, "muteAdSound", "blurAds", ADS_SKIPPED_KEY],
      (result) => {
        if (api?.runtime?.lastError) {
          logWarn(
            "Background: storage get error:",
            api.runtime.lastError.message,
          );
          return;
        }

        const updates: Record<string, unknown> = {};

        if (typeof result[WATCHER_STORAGE_KEY] === "undefined") {
          updates[WATCHER_STORAGE_KEY] = DEFAULT_WATCHER_STATE;
        }
        if (typeof result.muteAdSound === "undefined") {
          updates.muteAdSound = true;
        }
        if (typeof result.blurAds === "undefined") {
          updates.blurAds = false;
        }

        if (Object.keys(updates).length > 0) {
          const now = Date.now();
          if (now - lastWriteTime >= WRITE_THROTTLE_MS) {
            lastWriteTime = now;
            api.storage.sync.set(updates, () => {
              const setError = api?.runtime?.lastError?.message;
              if (setError) {
                logWarn("Background: failed to set defaults:", setError);
                if (
                  setError.includes("quota") ||
                  setError.includes("MAX_WRITE")
                ) {
                  WRITE_THROTTLE_MS = 2000;
                }
              } else {
                logDebug("Background: defaults initialized");
              }
            });
          }
        }

        // Migrate the legacy sync counter to local storage once.
        migrateCounter(
          typeof result[ADS_SKIPPED_KEY] === "number"
            ? (result[ADS_SKIPPED_KEY] as number)
            : null,
        );
      },
    );
  } catch (error) {
    logWarn("Background: failed to ensure default settings", error);
  }
};

const migrateCounter = (legacyValue: number | null) => {
  if (!api?.storage?.local) return;

  api.storage.local.get([ADS_SKIPPED_KEY], (localResult) => {
    if (api?.runtime?.lastError) return;

    const localValue =
      typeof localResult[ADS_SKIPPED_KEY] === "number"
        ? (localResult[ADS_SKIPPED_KEY] as number)
        : null;

    if (localValue === null) {
      api.storage.local.set({ [ADS_SKIPPED_KEY]: legacyValue ?? 0 });
    }

    if (legacyValue !== null) {
      api.storage.sync.remove(ADS_SKIPPED_KEY);
    }
  });
};

if (api?.runtime?.onInstalled) {
  try {
    api.runtime.onInstalled.addListener((details) => {
      try {
        ensureDefaults();
        logDebug("Extension", details.reason);
      } catch (error) {
        logWarn("Failed during installation handling", error);
      }
    });
  } catch (error) {
    logWarn("Failed to set up installation listener", error);
  }
}

if (api?.runtime?.onMessage) {
  try {
    api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      try {
        if (message?.type === "GET_WATCHER_STATE") {
          if (!api?.storage?.sync) {
            sendResponse({ enabled: DEFAULT_WATCHER_STATE });
            return false;
          }

          api.storage.sync.get([WATCHER_STORAGE_KEY], (result) => {
            if (api?.runtime?.lastError) {
              sendResponse({ enabled: DEFAULT_WATCHER_STATE });
              return;
            }
            const stored = result[WATCHER_STORAGE_KEY];
            sendResponse({
              enabled:
                typeof stored === "boolean" ? stored : DEFAULT_WATCHER_STATE,
            });
          });
          return true;
        }

        if (message?.type === "SET_WATCHER_STATE") {
          if (!api?.storage?.sync) {
            sendResponse({ success: false });
            return false;
          }

          const now = Date.now();
          if (now - lastWriteTime >= WRITE_THROTTLE_MS) {
            lastWriteTime = now;
            api.storage.sync.set(
              { [WATCHER_STORAGE_KEY]: message.enabled },
              () => {
                if (api?.runtime?.lastError) {
                  logWarn(
                    "Failed to set watcher state",
                    api.runtime.lastError.message,
                  );
                  sendResponse({ success: false });
                } else {
                  sendResponse({ success: true });
                }
              },
            );
            return true;
          }

          sendResponse({ success: true, throttled: true });
          return false;
        }

        return false;
      } catch (error) {
        logWarn("Failed during message handling", error);
        sendResponse({ success: false, error: "Internal error" });
        return false;
      }
    });
  } catch (error) {
    logWarn("Failed to set up message listener", error);
  }
}

// Initialize on service worker / background script startup too.
ensureDefaults();
