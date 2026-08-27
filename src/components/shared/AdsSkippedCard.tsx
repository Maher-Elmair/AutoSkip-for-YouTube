import React, { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { SkipForward, AlertTriangle } from "lucide-react";
import { containerVariants, itemVariants } from "@/utils/variants";
import { resolveBrowserApi } from "@/extension/shared/browserApi";
import { logWarn } from "@/extension/shared/logger";
import { ADS_SKIPPED_KEY, SELECTORS_STALE_KEY } from "@/constants/storage";

interface AdsSkippedCardProps {
  t: (key: string) => string;
  watcherEnabled?: boolean;
  isRTL?: boolean;
}

const AdsSkippedCard: React.FC<AdsSkippedCardProps> = ({
  t,
  watcherEnabled = true,
}) => {
  const [adsSkipped, setAdsSkipped] = useState(0);
  // Computed once, synchronously, at mount — avoids an avoidable extra
  // render from calling setState inside the effect body for this branch.
  const [isLoading, setIsLoading] = useState(
    () => Boolean(resolveBrowserApi()?.storage?.local)
  );
  const [selectorsStale, setSelectorsStale] = useState(false);

  // The counter lives in storage.local (frequent writes, no sync quota).
  const handleStorageChange = useCallback(
    (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== "local") return;

      const change = changes[ADS_SKIPPED_KEY];
      if (change && typeof change.newValue === "number") {
        setAdsSkipped(change.newValue);
      }

      const stale = changes[SELECTORS_STALE_KEY];
      if (stale) {
        setSelectorsStale(Boolean(stale.newValue));
      }
    },
    []
  );

 useEffect(() => {
  let mounted = true;
  const api = resolveBrowserApi();

  // isLoading already starts as `false` in this case (see useState
  // initializer above), so there is nothing to synchronize here.
  if (!api?.storage?.local) {
    return;
  }

  (async () => {
    try {
      await new Promise<void>((resolve) => {
        api.storage.local.get([ADS_SKIPPED_KEY, SELECTORS_STALE_KEY], (result) => {
          if (!mounted) {
            resolve();
            return;
          }

          if (api.runtime?.lastError) {
            logWarn("Failed to load ads skipped count", api.runtime.lastError);
            setIsLoading(false);
            resolve();
            return;
          }

          if (typeof result[ADS_SKIPPED_KEY] === "number") {
            setAdsSkipped(result[ADS_SKIPPED_KEY] as number);
          }
          setSelectorsStale(Boolean(result[SELECTORS_STALE_KEY]));
          setIsLoading(false);
          resolve();
        });
      });
    } catch (error) {
      if (!mounted) return;
      logWarn("Failed to load ads skipped count", error);
      setIsLoading(false);
    }
  })();

  return () => {
    mounted = false;
  };
}, []);

  useEffect(() => {
    const api = resolveBrowserApi();
    if (!api?.storage?.onChanged) return;

    try {
      api.storage.onChanged.addListener(handleStorageChange);
      return () => {
        try {
          api.storage.onChanged.removeListener(handleStorageChange);
        } catch (error) {
          logWarn("Failed to remove storage change listener", error);
        }
      };
    } catch (error) {
      logWarn("Failed to add storage change listener", error);
      return undefined;
    }
  }, [handleStorageChange]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-2xl mx-auto px-4 container mt-4"
    >
      <motion.div variants={itemVariants}>
        <motion.div
          whileHover={{
            y: -2,
            boxShadow: "0 10px 15px rgba(0,0,0,0.1)",
            borderRadius: "1rem",
          }}
          transition={{ duration: 0.2 }}
        >
          <Card
            className={`px-6 gap-2 shadow-md transition-all duration-300 bg-background border-2 overflow-hidden relative rounded-xl ${
              watcherEnabled ? "border-primary/30" : "border-border opacity-70"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div
                  className={`flex items-center gap-2.5
                  }`}
                >
                  <motion.div
                    whileHover={{
                      y: -2,
                      boxShadow: "0 10px 15px rgba(0,0,0,0.1)",
                      borderRadius: "1rem",
                      rotate: 360,
                    }}
                    transition={{ duration: 0.4 }}
                  >
                    <SkipForward
                      className={"icon-flip w-5 h-5 text-primary"}
                    />
                  </motion.div>
                  <h3 className="text-base font-semibold text-foreground text-start">
                    {t("adsSkipped")}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground text-start">
                  {t("adsSkippedDesc")}
                </p>
              </div>
              <motion.div
                className={`px-4 py-2 rounded-xl transition-all duration-300 ${
                  watcherEnabled ? "bg-primary/20 shadow-xl " : "bg-muted shadow-none"
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                key={adsSkipped}
                initial={{ scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <span
                  className={"text-2xl font-semibold text-primary"}
                >
                  {isLoading ? "..." : adsSkipped}
                </span>
              </motion.div>
            </div>
            {selectorsStale && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{t("selectorsStale")}</span>
              </div>
            )}
          </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default AdsSkippedCard;