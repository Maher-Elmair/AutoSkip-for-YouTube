import {
  ADS_SKIPPED_KEY,
  DEFAULT_WATCHER_STATE,
  WATCHER_STORAGE_KEY,
} from "@/constants/storage";
import { resolveBrowserApi } from "./shared/browserApi";
import { logDebug, logWarn } from "./shared/logger";
import { storageGet, storageRemove, storageSet } from "./shared/storage";

const api = resolveBrowserApi();

// Throttle storage writes to avoid sync quota issues.
let lastWriteTime = 0;
const WRITE_THROTTLE_MS = 1000;

/** Settings live in sync; the counter lives in local. */
const ensureDefaults = async () => {
  if (!api?.storage?.sync) {
    logWarn("Background: storage API not available");
    return;
  }

  try {
    const result = await storageGet("sync", [
      WATCHER_STORAGE_KEY,
      "muteAdSound",
      "blurAds",
      ADS_SKIPPED_KEY,
    ]);

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
        const ok = await storageSet("sync", updates);
        if (ok) logDebug("Background: defaults initialized");
      }
    }

    // Migrate the legacy sync counter to local storage once.
    await migrateCounter(
      typeof result[ADS_SKIPPED_KEY] === "number"
        ? (result[ADS_SKIPPED_KEY] as number)
        : null,
    );
  } catch (error) {
    logWarn("Background: failed to ensure default settings", error);
  }
};

const migrateCounter = async (legacyValue: number | null) => {
  if (!api?.storage?.local) return;

  const localResult = await storageGet("local", [ADS_SKIPPED_KEY]);
  const localValue =
    typeof localResult[ADS_SKIPPED_KEY] === "number"
      ? (localResult[ADS_SKIPPED_KEY] as number)
      : null;

  if (localValue === null) {
    await storageSet("local", { [ADS_SKIPPED_KEY]: legacyValue ?? 0 });
  }

  if (legacyValue !== null) {
    await storageRemove("sync", ADS_SKIPPED_KEY);
  }
};

if (api?.runtime?.onInstalled) {
  try {
    api.runtime.onInstalled.addListener((details) => {
      void ensureDefaults();
      logDebug("Extension", details.reason);
    });
  } catch (error) {
    logWarn("Failed to set up installation listener", error);
  }
}

/**
 * Auto mode: a real (trusted) mouse click via the DevTools protocol.
 * Requires the OPTIONAL `debugger` permission, which is only ever requested
 * from the popup when the user picks "auto".
 */
const dispatchTrustedClick = async (
  tabId: number | undefined,
  x: number,
  y: number,
  sendResponse: (response: unknown) => void,
) => {
  const debuggerApi = (api as typeof chrome | undefined)?.debugger;
  const permissions = (api as typeof chrome | undefined)?.permissions;

  if (!tabId) return sendResponse({ success: false, reason: "no-tab" });
  if (!debuggerApi || !permissions) {
    return sendResponse({ success: false, reason: "unsupported" });
  }

  try {
    // Defensive only: `debugger` is a required manifest permission, so this
    // should never fail unless a power user revoked it by hand.
    const granted = await permissions.contains({ permissions: ["debugger"] });
    if (!granted) {
      return sendResponse({ success: false, reason: "unexpected-missing-permission" });
    }
  } catch {
    return sendResponse({ success: false, reason: "unexpected-missing-permission" });
  }

  const target = { tabId };
  let attached = false;

  try {
    await debuggerApi.attach(target, "1.3");
    attached = true;

    const base = { x, y, button: "left" as const, clickCount: 1 };
    await debuggerApi.sendCommand(target, "Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x,
      y,
    });
    await debuggerApi.sendCommand(target, "Input.dispatchMouseEvent", {
      ...base,
      type: "mousePressed",
      buttons: 1,
    });
    await debuggerApi.sendCommand(target, "Input.dispatchMouseEvent", {
      ...base,
      type: "mouseReleased",
      buttons: 0,
    });

    sendResponse({ success: true });
  } catch (error) {
    logWarn("Trusted click failed", error);
    sendResponse({ success: false, reason: "attach-failed" });
  } finally {
    if (attached) {
      try {
        await debuggerApi.detach(target);
      } catch {
        /* already detached */
      }
    }
  }
};

if (api?.runtime?.onMessage) {
  try {
    api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      try {
        if (message?.type === "GET_WATCHER_STATE") {
          if (!api?.storage?.sync) {
            sendResponse({ enabled: DEFAULT_WATCHER_STATE });
            return false;
          }

          void storageGet("sync", [WATCHER_STORAGE_KEY]).then((result) => {
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
            void storageSet("sync", {
              [WATCHER_STORAGE_KEY]: message.enabled,
            }).then((ok) => sendResponse({ success: ok }));
            return true;
          }

          sendResponse({ success: true, throttled: true });
          return false;
        }

        if (message?.type === "SKIP_AD_TRUSTED_CLICK") {
          void dispatchTrustedClick(
            _sender?.tab?.id,
            message.x,
            message.y,
            sendResponse,
          );
          return true; // async response
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
void ensureDefaults();
