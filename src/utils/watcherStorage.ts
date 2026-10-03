import {
  DEFAULT_WATCHER_STATE,
  LOCAL_STORAGE_NAMESPACE,
  WATCHER_STORAGE_KEY,
} from "@/constants/storage";
import { resolveBrowserApi } from "@/extension/shared/browserApi";
import {
  onStorageChanged,
  storageGet,
  storageSet,
} from "@/extension/shared/storage";

type StorageListener = (enabled: boolean) => void;

const FALLBACK_KEY = `${LOCAL_STORAGE_NAMESPACE}:${WATCHER_STORAGE_KEY}`;

const hasExtensionStorage = () => !!resolveBrowserApi()?.storage?.sync;

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
  if (!hasExtensionStorage()) {
    return readFromFallback();
  }

  const result = await storageGet("sync", [WATCHER_STORAGE_KEY]);
  const storedValue = result[WATCHER_STORAGE_KEY];

  return typeof storedValue === "boolean" ? storedValue : DEFAULT_WATCHER_STATE;
};

export const writeWatcherState = async (enabled: boolean): Promise<void> => {
  if (!hasExtensionStorage()) {
    writeToFallback(enabled);
    return;
  }

  const ok = await storageSet("sync", { [WATCHER_STORAGE_KEY]: enabled });
  if (ok) {
    writeToFallback(enabled);
  }
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

  return onStorageChanged("sync", (changes) => {
    const change = changes[WATCHER_STORAGE_KEY];
    if (change && typeof change.newValue === "boolean") {
      listener(change.newValue);
    }
  });
};
