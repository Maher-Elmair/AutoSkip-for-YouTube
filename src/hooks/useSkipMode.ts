import { useEffect, useState } from "react";
import {
  DEFAULT_SKIP_MODE,
  SKIP_MODE_AUTO_INTRO_SEEN_KEY,
  SKIP_MODE_KEY,
  isSkipMode,
  type SkipMode,
} from "@/constants/storage";
import { resolveBrowserApi } from "@/extension/shared/browserApi";
import { logWarn } from "@/extension/shared/logger";
import { onStorageChanged, storageGet, storageSet } from "@/extension/shared/storage";

/**
 * Reads/writes the three-state skip mode from storage.sync, mirroring the
 * shape of useWatcherSetting. The `debugger` permission is now a required
 * manifest permission, so the only extra state tracked here is whether the
 * user has already seen the one-time Auto-mode explainer dialog.
 */
export const useSkipMode = () => {
  const [skipMode, setSkipModeState] = useState<SkipMode>(DEFAULT_SKIP_MODE);
  const [autoIntroSeen, setAutoIntroSeenState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    if (!resolveBrowserApi()?.storage?.sync) {
      setIsLoading(false);
      return;
    }

    (async () => {
      try {
        const result = await storageGet("sync", [
          SKIP_MODE_KEY,
          SKIP_MODE_AUTO_INTRO_SEEN_KEY,
        ]);
        if (!mounted) return;
        if (isSkipMode(result[SKIP_MODE_KEY])) {
          setSkipModeState(result[SKIP_MODE_KEY]);
        }
        if (typeof result[SKIP_MODE_AUTO_INTRO_SEEN_KEY] === "boolean") {
          setAutoIntroSeenState(result[SKIP_MODE_AUTO_INTRO_SEEN_KEY]);
        }
      } catch (error) {
        logWarn("Failed to load skip mode", error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // The content script can downgrade auto -> assist when something goes
  // wrong; reflect that immediately in the popup.
  useEffect(
    () =>
      onStorageChanged("sync", (changes) => {
        const change = changes[SKIP_MODE_KEY];
        if (change && isSkipMode(change.newValue)) {
          setSkipModeState(change.newValue);
        }
      }),
    []
  );

  const setSkipMode = (mode: SkipMode) => {
    setSkipModeState(mode);
    void storageSet("sync", { [SKIP_MODE_KEY]: mode });
  };

  const setAutoIntroSeen = (value: boolean) => {
    setAutoIntroSeenState(value);
    void storageSet("sync", { [SKIP_MODE_AUTO_INTRO_SEEN_KEY]: value });
  };

  return { skipMode, setSkipMode, autoIntroSeen, setAutoIntroSeen, isLoading };
};
