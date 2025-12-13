import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { SkipForward } from "lucide-react";
import { containerVariants, itemVariants } from "@/utils/variants";

interface AdsSkippedCardProps {
  isRTL: boolean;
  t: (key: string) => string;
}

const AdsSkippedCard: React.FC<AdsSkippedCardProps> = ({ isRTL, t }) => {
  const [adsSkipped, setAdsSkipped] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Memoized storage change handler
  const handleStorageChange = useCallback(
    (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== "sync") {
        return;
      }

      const change = changes["adsSkipped"];
      if (change && typeof change.newValue === "number") {
        console.warn(`[autoskip] Ads skipped count updated to: ${change.newValue}`);
        setAdsSkipped(change.newValue);
      }
    },
    []
  );

  // Load initial value
  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      try {
        const browserApi =
          typeof chrome !== "undefined" && chrome.storage?.sync
            ? chrome
            : typeof browser !== "undefined" && browser?.storage?.sync
            ? (browser as typeof chrome)
            : null;

        if (browserApi?.storage?.sync) {
          browserApi.storage.sync.get(["adsSkipped"], (result) => {
            // Check for errors
            if (browserApi?.runtime?.lastError) {
              console.warn("[autoskip] Failed to load ads skipped count", browserApi.runtime.lastError);
              if (mounted) {
                setIsLoading(false);
              }
              return;
            }

            if (mounted) {
              if (typeof result.adsSkipped === "number") {
                setAdsSkipped(result.adsSkipped);
                console.warn(`[autoskip] Loaded ads skipped count: ${result.adsSkipped}`);
              }
              setIsLoading(false);
            }
          });
        } else {
          if (mounted) {
            setIsLoading(false);
          }
        }
      } catch (error) {
        if (mounted) {
          setIsLoading(false);
        }
        console.warn("[autoskip] Failed to load ads skipped count", error);
      }
    };

    loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  // Listen for storage changes
  useEffect(() => {
    const browserApi =
      typeof chrome !== "undefined" && chrome.storage?.sync
        ? chrome
        : typeof browser !== "undefined" && browser?.storage?.sync
        ? (browser as typeof chrome)
        : null;

    if (!browserApi?.storage?.onChanged) {
      return;
    }

    try {
      browserApi.storage.onChanged.addListener(handleStorageChange);
      console.warn("[autoskip] Registered ads skipped counter listener");

      return () => {
        try {
          browserApi.storage.onChanged.removeListener(handleStorageChange);
          console.warn("[autoskip] Removed ads skipped counter listener");
        } catch (error) {
          console.warn("[autoskip] Failed to remove storage change listener", error);
        }
      };
    } catch (error) {
      console.warn("[autoskip] Failed to add storage change listener", error);
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
          <Card className="px-6 gap-2 shadow-md transition-all duration-300 bg-background  border-2 overflow-hidden relative border-primary/30 rounded-xl">
            <div
              className={`flex items-center justify-between ${
                isRTL ? "flex-row-reverse" : ""
              }`}
            >
              <div>
                <div
                  className={`flex items-center gap-2.5 ${
                    isRTL ? "flex-row-reverse" : ""
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
                      className={`w-5 h-5 text-primary ${
                        isRTL ? "rotate-180" : "rotate-0"
                      }`}
                    />
                  </motion.div>
                  <h3
                    className={`text-base font-semibold text-foreground ${
                      isRTL ? "text-right" : "text-left"
                    }`}
                  >
                    {t("adsSkipped")}
                  </h3>
                </div>
                <p
                  className={`text-sm text-muted-foreground ${
                    isRTL ? "text-right" : "text-left"
                  }`}
                >
                  {t("adsSkippedDesc")}
                </p>
              </div>
              <motion.div
                className="px-4 py-2 rounded-xl transition-all duration-300 
                  bg-primary/20 shadow-xl"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                key={adsSkipped}
                initial={{ scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <span className="text-2xl font-semibold text-primary">
                  {isLoading ? "..." : adsSkipped}
                </span>
              </motion.div>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default AdsSkippedCard;