import {
  DEFAULT_WATCHER_STATE,
  LOCAL_STORAGE_NAMESPACE,
  WATCHER_STORAGE_KEY,
} from "@/constants/storage";

type ChromeLike = typeof chrome;
type StorageListener = (enabled: boolean) => void;

const FALLBACK_KEY = `${LOCAL_STORAGE_NAMESPACE}:${WATCHER_STORAGE_KEY}`;

const resolveBrowserApi = (): ChromeLike | undefined => {
  if (typeof chrome !== "undefined" && chrome.storage?.sync) {
    return chrome;
  }

  if (typeof browser !== "undefined" && browser?.storage?.sync) {
    return browser as unknown as ChromeLike;
  }

  return undefined;
};

const readFromFallback = (): boolean => {
  if (typeof window === "undefined") {
    return DEFAULT_WATCHER_STATE;
  }

  const stored = window.localStorage.getItem(FALLBACK_KEY);
  return stored === null ? DEFAULT_WATCHER_STATE : stored === "true";
};

const writeToFallback = (value: boolean) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(FALLBACK_KEY, String(value));
};

export const readWatcherState = async (): Promise<boolean> => {
  const api = resolveBrowserApi();

  if (!api?.storage?.sync) {
    return readFromFallback();
  }

  return new Promise((resolve) => {
    api.storage.sync.get([WATCHER_STORAGE_KEY], (result) => {
      const storedValue = result[WATCHER_STORAGE_KEY];
      if (api.runtime?.lastError) {
        console.warn(
          "[autoskip] Failed to read watcher flag:",
          api.runtime.lastError.message
        );
        resolve(readFromFallback());
        return;
      }

      resolve(
        typeof storedValue === "boolean" ? storedValue : DEFAULT_WATCHER_STATE
      );
    });
  });
};

export const writeWatcherState = async (enabled: boolean): Promise<void> => {
  const api = resolveBrowserApi();

  if (!api?.storage?.sync) {
    writeToFallback(enabled);
    return;
  }

  await new Promise<void>((resolve) => {
    api.storage.sync.set({ [WATCHER_STORAGE_KEY]: enabled }, () => {
      if (api.runtime?.lastError) {
        console.warn(
          "[autoskip] Failed to persist watcher flag:",
          api.runtime.lastError.message
        );
      } else {
        writeToFallback(enabled);
      }
      resolve();
    });
  });
};

export const onWatcherStateChange = (
  listener: StorageListener
): (() => void) => {
  const api = resolveBrowserApi();

  if (!api?.storage?.onChanged) {
    const handler = (event: StorageEvent) => {
      if (event.key === FALLBACK_KEY && event.newValue !== event.oldValue) {
        listener(event.newValue === "true");
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    }

    return () => undefined;
  }

  const handleExtensionChange = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ) => {
    if (areaName !== "sync") {
      return;
    }

    const change = changes[WATCHER_STORAGE_KEY];
    if (change && typeof change.newValue === "boolean") {
      listener(change.newValue);
    }
  };

  api.storage.onChanged.addListener(handleExtensionChange);
  return () => api.storage.onChanged.removeListener(handleExtensionChange);
};