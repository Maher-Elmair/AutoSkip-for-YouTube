import {
  DEFAULT_WATCHER_STATE,
  WATCHER_STORAGE_KEY,
} from "@/constants/storage";

type ChromeLike = typeof chrome;

const resolveBrowserApi = (): ChromeLike | undefined => {
  if (typeof chrome !== "undefined" && chrome.storage?.sync) {
    return chrome;
  }

  if (typeof browser !== "undefined" && browser?.storage?.sync) {
    return browser as unknown as ChromeLike;
  }

  return undefined;
};

const api = resolveBrowserApi();

// Throttle storage writes to avoid quota issues
let lastWriteTime = 0;
let WRITE_THROTTLE_MS = 1000;

const ensureDefaults = () => {
  if (!api?.storage?.sync) {
    console.warn("[autoskip] Background: Storage API not available");
    return;
  }

  try {
    api.storage.sync.get(
      [WATCHER_STORAGE_KEY, "muteAdSound", "blurAds", "adsSkipped"],
      (result) => {
        // Check for errors
        if (api?.runtime?.lastError) {
          const errorMsg = api.runtime.lastError.message || "Unknown error";
          console.warn(`[autoskip] Background: Storage get error: ${errorMsg}`);
          
          // Check for specific errors
          if (errorMsg.includes("quota") || errorMsg.includes("MAX_WRITE")) {
            console.warn("[autoskip] Background: Storage quota error - reducing write frequency");
          }
          return;
        }

        const updates: Record<string, any> = {};

        // Initialize watcher state
        if (typeof result[WATCHER_STORAGE_KEY] === "undefined") {
          updates[WATCHER_STORAGE_KEY] = DEFAULT_WATCHER_STATE;
          console.warn("[autoskip] Background: Initializing watcher state to default");
        }

        // Initialize mute feature (default: true)
        if (typeof result.muteAdSound === "undefined") {
          updates.muteAdSound = true;
          console.warn("[autoskip] Background: Initializing muteAdSound to true");
        }

        // Initialize blur feature (default: false)
        if (typeof result.blurAds === "undefined") {
          updates.blurAds = false;
          console.warn("[autoskip] Background: Initializing blurAds to false");
        }

        // Initialize counter (default: 0)
        if (typeof result.adsSkipped === "undefined") {
          updates.adsSkipped = 0;
          console.warn("[autoskip] Background: Initializing adsSkipped counter to 0");
        }

        // Only write if there are updates
        if (Object.keys(updates).length > 0) {
          const now = Date.now();
          if (now - lastWriteTime >= WRITE_THROTTLE_MS) {
            lastWriteTime = now;
            api.storage.sync.set(updates, () => {
              if (api?.runtime?.lastError) {
                const setError = api.runtime.lastError.message || "Unknown set error";
                console.warn(`[autoskip] Background: Failed to set defaults: ${setError}`);
                
                // Handle specific quota errors
                if (setError.includes("quota") || setError.includes("MAX_WRITE")) {
                  console.warn("[autoskip] Background: Storage quota exceeded - increasing throttle time");
                  WRITE_THROTTLE_MS = 2000; // Increase throttle time
                }
              } else {
                console.warn("[autoskip] Background: Default settings initialized successfully");
              }
            });
          } else {
            console.warn("[autoskip] Background: Write throttled - skipping initialization");
          }
        } else {
          console.warn("[autoskip] Background: All settings already initialized");
        }
      }
    );
  } catch (error) {
    console.warn("[autoskip] Background: Failed to ensure default settings", error);
  }
};

// Handle installation
if (api?.runtime?.onInstalled) {
  try {
    api.runtime.onInstalled.addListener((details) => {
      try {
        ensureDefaults();
        
        if (details.reason === 'install') {
          console.warn("[autoskip] Extension installed successfully");
        } else if (details.reason === 'update') {
          console.warn("[autoskip] Extension updated");
        }
      } catch (error) {
        console.warn("[autoskip] Failed during installation handling", error);
      }
    });
  } catch (error) {
    console.warn("[autoskip] Failed to set up installation listener", error);
  }
}

// Handle messages with proper async response handling
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
              console.warn("[autoskip] Failed to get watcher state", api.runtime.lastError);
              sendResponse({ enabled: DEFAULT_WATCHER_STATE });
              return;
            }
            
            const stored = result[WATCHER_STORAGE_KEY];
            const enabled = typeof stored === "boolean" ? stored : DEFAULT_WATCHER_STATE;
            sendResponse({ enabled });
          });
          return true; // Indicate async response
        }

        if (message?.type === "SET_WATCHER_STATE") {
          if (!api?.storage?.sync) {
            sendResponse({ success: false });
            return false;
          }

          const enabled = message.enabled;
          const now = Date.now();
          
          if (now - lastWriteTime >= WRITE_THROTTLE_MS) {
            lastWriteTime = now;
            api.storage.sync.set({ [WATCHER_STORAGE_KEY]: enabled }, () => {
              if (api?.runtime?.lastError) {
                console.warn("[autoskip] Failed to set watcher state", api.runtime.lastError);
                sendResponse({ success: false });
              } else {
                console.warn(`[autoskip] Watcher state updated to: ${enabled}`);
                sendResponse({ success: true });
              }
            });
            return true; // Indicate async response
          } else {
            // Throttled, but still respond successfully
            console.warn("[autoskip] Write throttled, operation delayed");
            sendResponse({ success: true, throttled: true });
            return false;
          }
        }

        return false;
      } catch (error) {
        sendResponse({ success: false, error: "Internal error" });
        console.warn("[autoskip] Failed during message handling", error);
        return false;
      }
    });
  } catch (error) {
    console.warn("[autoskip] Failed to set up message listener", error);
  }
}

// Handle tab updates with error handling
if (api?.tabs?.onUpdated) {
  try {
    api.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
      try {
        if (changeInfo.status === 'complete' && tab.url?.includes('youtube.com')) {
          console.warn("[autoskip] YouTube page loaded, injecting content script");
        }
      } catch (error) {
        console.warn("[autoskip] Failed during tab update handling", error);
      }
    });
  } catch (error) {
    console.warn("[autoskip] Failed to set up tab update listener", error);
  }
}

// Handle context invalidation gracefully
if (api?.runtime?.onSuspend) {
  try {
    api.runtime.onSuspend.addListener(() => {
      try {
        console.warn("[autoskip] Extension is being suspended, cleaning up");
      } catch (error) {
        console.warn("[autoskip] Failed during runtime suspension", error);
      }
    });
  } catch (error) {
    console.warn("[autoskip] Failed to set up runtime suspend listener", error);
  }
}