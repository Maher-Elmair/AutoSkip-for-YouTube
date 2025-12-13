import { useEffect, useState } from "react";
import {
  onWatcherStateChange,
  readWatcherState,
  writeWatcherState,
} from "@/utils/watcherStorage";
import { DEFAULT_WATCHER_STATE } from "@/constants/storage";

export const useWatcherSetting = () => {
  const [watcherEnabled, setWatcherEnabled] = useState<boolean>(
    DEFAULT_WATCHER_STATE
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    readWatcherState()
      .then((value) => {
        if (!cancelled) {
          setWatcherEnabled(value);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    const unsubscribe = onWatcherStateChange((value) => {
      setWatcherEnabled(value);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const persistWatcherState = (value: boolean) => {
    setWatcherEnabled(value);
    void writeWatcherState(value);
  };

  return {
    watcherEnabled,
    setWatcherEnabled: persistWatcherState,
    isLoading,
  };
};