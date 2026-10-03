/**
 * Cross-browser storage layer.
 *
 * Chrome/Edge/Brave/Opera (MV3) expose both callback and promise styles,
 * while Firefox's `browser.*` namespace is promise-only and silently ignores
 * a trailing callback (which used to hang every `await` in this project).
 *
 * Every storage access in the extension goes through these helpers, so no
 * call site has to know which style the current browser uses.
 */
import { resolveBrowserApi } from "./browserApi";
import { logWarn } from "./logger";

export type StorageArea = "sync" | "local";
export type StorageRecord = Record<string, unknown>;

type AnyBucket = {
  get: (keys: string[] | null, cb?: (items: StorageRecord) => void) => unknown;
  set: (items: StorageRecord, cb?: () => void) => unknown;
  remove: (keys: string | string[], cb?: () => void) => unknown;
};

const isThenable = (value: unknown): value is Promise<unknown> =>
  typeof (value as { then?: unknown } | null)?.then === "function";

const getBucket = (area: StorageArea): AnyBucket | null => {
  const api = resolveBrowserApi();
  const bucket = api?.storage?.[area] as AnyBucket | undefined;
  return bucket ?? null;
};

/** Surfaces (and clears) chrome.runtime.lastError without throwing. */
const lastErrorMessage = (): string | null => {
  const api = resolveBrowserApi();
  return api?.runtime?.lastError?.message ?? null;
};

export const isExtensionContextInvalidated = (message: string | null) =>
  !!message && message.includes("Extension context invalidated");

export const storageGet = async (
  area: StorageArea,
  keys: string[],
): Promise<StorageRecord> => {
  const bucket = getBucket(area);
  if (!bucket) return {};

  try {
    const maybePromise = bucket.get(keys);
    if (isThenable(maybePromise)) {
      return ((await maybePromise) as StorageRecord) ?? {};
    }

    return await new Promise<StorageRecord>((resolve) => {
      bucket.get(keys, (items) => {
        const error = lastErrorMessage();
        if (error) {
          logWarn(`storage.${area}.get failed:`, error);
          resolve({});
          return;
        }
        resolve(items ?? {});
      });
    });
  } catch (error) {
    logWarn(`storage.${area}.get failed:`, error);
    return {};
  }
};

export const storageSet = async (
  area: StorageArea,
  items: StorageRecord,
): Promise<boolean> => {
  const bucket = getBucket(area);
  if (!bucket) return false;

  try {
    const maybePromise = bucket.set(items);
    if (isThenable(maybePromise)) {
      await maybePromise;
      return true;
    }

    return await new Promise<boolean>((resolve) => {
      bucket.set(items, () => {
        const error = lastErrorMessage();
        if (error) {
          logWarn(`storage.${area}.set failed:`, error);
          resolve(false);
          return;
        }
        resolve(true);
      });
    });
  } catch (error) {
    logWarn(`storage.${area}.set failed:`, error);
    return false;
  }
};

export const storageRemove = async (
  area: StorageArea,
  keys: string | string[],
): Promise<void> => {
  const bucket = getBucket(area);
  if (!bucket) return;

  try {
    const maybePromise = bucket.remove(keys);
    if (isThenable(maybePromise)) {
      await maybePromise;
      return;
    }

    await new Promise<void>((resolve) => {
      bucket.remove(keys, () => {
        lastErrorMessage();
        resolve();
      });
    });
  } catch (error) {
    logWarn(`storage.${area}.remove failed:`, error);
  }
};

type ChangeMap = Record<string, { newValue?: unknown; oldValue?: unknown }>;

/** Subscribes to a storage area; returns an unsubscribe function. */
export const onStorageChanged = (
  area: StorageArea,
  listener: (changes: ChangeMap) => void,
): (() => void) => {
  const api = resolveBrowserApi();
  const onChanged = api?.storage?.onChanged;
  if (!onChanged) return () => undefined;

  const handler = (changes: ChangeMap, areaName: string) => {
    if (areaName !== area) return;
    try {
      listener(changes);
    } catch (error) {
      logWarn("Storage change listener failed", error);
    }
  };

  try {
    onChanged.addListener(handler as never);
    return () => {
      try {
        onChanged.removeListener(handler as never);
      } catch {
        /* listener already gone */
      }
    };
  } catch (error) {
    logWarn("Failed to subscribe to storage changes", error);
    return () => undefined;
  }
};
