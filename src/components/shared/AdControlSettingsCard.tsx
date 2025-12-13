import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { SkipForward, Volume2, Eye } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { containerVariants, itemVariants } from "@/utils/variants";

interface AdControlSettingsCardProps {
  watcherEnabled: boolean;
  isRTL: boolean;
  t: (key: string) => string;
}

const AdControlSettingsCard: React.FC<AdControlSettingsCardProps> = ({
  watcherEnabled,
  isRTL,
  t,
}) => {
  const [muteAdSound, setMuteAdSound] = useState(true);
  const [blurAds, setBlurAds] = useState(false);

  // Load saved settings from storage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const browserApi =
          typeof chrome !== "undefined" && chrome.storage?.sync
            ? chrome
            : typeof browser !== "undefined" && browser?.storage?.sync
            ? (browser as typeof chrome)
            : null;

        if (browserApi?.storage?.sync) {
          browserApi.storage.sync.get(["muteAdSound", "blurAds"], (result) => {
            // Check for errors
            if (browserApi?.runtime?.lastError) {
              console.warn("[autoskip] Failed to load ad control settings", browserApi.runtime.lastError);
              return;
            }

            if (typeof result.muteAdSound === "boolean") {
              setMuteAdSound(result.muteAdSound);
              console.warn(`[autoskip] Loaded muteAdSound: ${result.muteAdSound}`);
            }
            if (typeof result.blurAds === "boolean") {
              setBlurAds(result.blurAds);
              console.warn(`[autoskip] Loaded blurAds: ${result.blurAds}`);
            }
          });
        }
      } catch (error) {
        console.warn("[autoskip] Failed to load ad control settings", error);
      }
    };

    loadSettings();
  }, []);

  // Save settings to storage
  useEffect(() => {
    const saveSettings = async () => {
      try {
        const browserApi =
          typeof chrome !== "undefined" && chrome.storage?.sync
            ? chrome
            : typeof browser !== "undefined" && browser?.storage?.sync
            ? (browser as typeof chrome)
            : null;

        if (browserApi?.storage?.sync) {
          browserApi.storage.sync.set({ muteAdSound, blurAds }, () => {
            // Check for errors but don't throw
            if (browserApi?.runtime?.lastError) {
              console.warn("[autoskip] Failed to save ad control settings", browserApi.runtime.lastError);
            } else {
              console.warn(`[autoskip] Saved ad control settings: muteAdSound=${muteAdSound}, blurAds=${blurAds}`);
            }
          });
        }
      } catch (error) {
        console.warn("[autoskip] Failed to save ad control settings", error);
      }
    };

    saveSettings();
  }, [muteAdSound, blurAds]);

  const handleMuteToggle = (checked: boolean) => {
    // Only allow toggle if main watcher is enabled
    if (watcherEnabled) {
      console.warn(`[autoskip] Setting muteAdSound to: ${checked}`);
      setMuteAdSound(checked);
    } else {
      console.warn("[autoskip] Cannot toggle muteAdSound - watcher is disabled");
    }
  };

  const handleBlurToggle = (checked: boolean) => {
    // Only allow toggle if main watcher is enabled
    if (watcherEnabled) {
      console.warn(`[autoskip] Setting blurAds to: ${checked}`);
      setBlurAds(checked);
    } else {
      console.warn("[autoskip] Cannot toggle blurAds - watcher is disabled");
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-2xl w-full mx-auto px-6 space-y-6 mb-4 "
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
          <Card className="py-6 px-4 gap-0 shadow-md transition-all duration-300 bg-card border-border/20 rounded-xl">
            {/* Header */}
            <div
              className={`flex items-center gap-2.5 mb-6 ${
                isRTL ? "flex-row-reverse" : ""
              }`}
            >
              {/* Icon Container */}
              <div className="p-2 rounded-md bg-primary/20 shadow-xl">
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
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {t("adControlSettings")}
              </h3>
            </div>
            <div className="flex justify-center flex-col gap-4">
              <motion.div
                whileHover={{
                  y: -2,
                  boxShadow: "0 10px 15px rgba(0,0,0,0.1)",
                  borderRadius: "1rem",
                }}
                transition={{ duration: 0.2 }}
              >
                {/* Mute Ad Sound Toggle */}
                <div
                  className={`p-4 rounded-lg transition-all duration-300 ${
                    watcherEnabled && muteAdSound
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-accent border border-transparent"
                  } ${!watcherEnabled ? "opacity-50" : ""}`}
                >
                  <div
                    className={`flex items-center justify-between ${
                      isRTL ? "flex-row-reverse" : ""
                    }`}
                  >
                    <div
                      className={`flex items-center gap-2 text-left ${
                        isRTL ? "flex-row-reverse text-right" : ""
                      }`}
                    >
                      <motion.div
                        whileHover={{
                          y: -2,
                          boxShadow: "0 10px 15px rgba(0,0,0,0.1)",
                          borderRadius: "1rem",
                        }}
                        transition={{ duration: 0.4 }}
                      >
                        <Volume2
                          className={`w-5 h-5 shrink-0 transition-colors ${
                            watcherEnabled && muteAdSound
                              ? "text-primary"
                              : "text-muted-foreground"
                          }
                        ${isRTL ? " rotate-180" : " rotate-0"}`}
                        />
                      </motion.div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-foreground mb-0.5">
                          {t("muteAdSound")}
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {t("muteAdSoundDesc")}
                        </p>
                      </div>
                    </div>
                    <div className={`shrink-0 ${isRTL ? "mr-3" : "ml-3"}`}>
                      <Switch
                        checked={muteAdSound}
                        onCheckedChange={handleMuteToggle}
                        disabled={!watcherEnabled}
                        dir={isRTL ? "rtl" : "ltr"}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
              <motion.div
                whileHover={{
                  y: -2,
                  boxShadow: "0 10px 15px rgba(0,0,0,0.1)",
                  borderRadius: "1rem",
                }}
                transition={{ duration: 0.2 }}
              >
                {/* Blur Ads Toggle */}
                <div
                  className={`p-4 rounded-lg transition-all duration-300 ${
                    watcherEnabled && blurAds
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-accent border border-transparent"
                  } ${!watcherEnabled ? "opacity-50" : ""}`}
                >
                  <div
                    className={`flex items-center justify-between ${
                      isRTL ? "flex-row-reverse" : ""
                    }`}
                  >
                    <div
                      className={`flex items-center gap-2 text-left ${
                        isRTL ? "flex-row-reverse text-right" : ""
                      }`}
                    >
                      <motion.div
                        whileHover={{
                          y: -2,
                          boxShadow: "0 10px 15px rgba(0,0,0,0.1)",
                          borderRadius: "1rem",
                        }}
                        transition={{ duration: 0.4 }}
                      >
                        <Eye
                          className={`w-5 h-5 shrink-0 transition-colors ${
                            watcherEnabled && blurAds
                              ? "text-primary"
                              : "text-muted-foreground"
                          }`}
                        />
                      </motion.div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-foreground mb-0.5">
                          {t("blurAds")}
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {t("blurAdsDesc")}
                        </p>
                      </div>
                    </div>
                    <div className={`shrink-0 ${isRTL ? "mr-3" : "ml-3"}`}>
                      <Switch
                        checked={blurAds}
                        onCheckedChange={handleBlurToggle}
                        disabled={!watcherEnabled}
                        dir={isRTL ? "rtl" : "ltr"}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default AdControlSettingsCard;