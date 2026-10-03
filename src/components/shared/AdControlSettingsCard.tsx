import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { SkipForward, Volume2, Eye, FastForward, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { containerVariants, itemVariants } from "@/utils/variants";
import { resolveBrowserApi } from "@/extension/shared/browserApi";
import { logDebug, logWarn } from "@/extension/shared/logger";
import { storageGet, storageSet } from "@/extension/shared/storage";
import SkipModeSwitch from "@/components/ui/skip-mode-switch";
import PermissionConfirmDialog from "@/components/shared/PermissionConfirmDialog";
import { useSkipMode } from "@/hooks/useSkipMode";
import type { SkipMode } from "@/constants/storage";

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
  const { skipMode, setSkipMode, autoIntroSeen, setAutoIntroSeen } =
    useSkipMode();
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [autoReminderVisible, setAutoReminderVisible] = useState(false);
  const autoReminderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (autoReminderTimer.current) clearTimeout(autoReminderTimer.current);
    },
    []
  );

  const showAutoReminder = () => {
    if (autoReminderTimer.current) clearTimeout(autoReminderTimer.current);
    setAutoReminderVisible(true);
    autoReminderTimer.current = setTimeout(() => {
      setAutoReminderVisible(false);
      autoReminderTimer.current = null;
    }, 4000);
  };

  const handleSkipModeChange = (mode: SkipMode) => {
    if (mode === skipMode) return;

    // "auto" shows the one-time explainer dialog; everything else applies now.
    if (mode === "auto" && !autoIntroSeen) {
      setPermissionDialogOpen(true);
      return;
    }

    if (mode === "auto") {
      setSkipMode(mode);
      showAutoReminder();
      return;
    }

    setAutoReminderVisible(false);
    setSkipMode(mode);
  };

  const confirmAutoMode = () => {
    setPermissionDialogOpen(false);
    setAutoIntroSeen(true);
    setSkipMode("auto");
  };

  const cancelAutoMode = () => {
    setPermissionDialogOpen(false);
    // Keep the previous mode — nothing was changed.
  };

  const skipModeDescKey =
    skipMode === "off"
      ? "skipModeOffDesc"
      : skipMode === "auto"
        ? "skipModeAutoDesc"
        : "skipModeAssistDesc";

  // Load saved settings once. There is no save-effect: writes happen only in
  // the toggle handlers, so a slow read can never overwrite a user action.
  useEffect(() => {
    let mounted = true;
    if (!resolveBrowserApi()?.storage?.sync) return;

    (async () => {
      try {
        const result = await storageGet("sync", ["muteAdSound", "blurAds"]);
        if (!mounted) return;
        if (typeof result.muteAdSound === "boolean") {
          setMuteAdSound(result.muteAdSound);
        }
        if (typeof result.blurAds === "boolean") {
          setBlurAds(result.blurAds);
        }
      } catch (error) {
        logWarn("Failed to load ad control settings", error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const persist = (values: Partial<Record<"muteAdSound" | "blurAds", boolean>>) => {
    if (!resolveBrowserApi()?.storage?.sync) return;

    void storageSet("sync", values).then((ok) => {
      if (ok) logDebug("Saved ad control settings", values);
      else logWarn("Failed to save ad control settings", values);
    });
  };

  const handleMuteToggle = (checked: boolean) => {
    if (!watcherEnabled) return;
    setMuteAdSound(checked);
    persist({ muteAdSound: checked });
  };

  const handleBlurToggle = (checked: boolean) => {
    if (!watcherEnabled) return;
    setBlurAds(checked);
    persist({ blurAds: checked });
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
              className="flex items-center gap-2.5 mb-6"
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
                  <SkipForward className="icon-flip w-5 h-5 text-primary" />
                </motion.div>
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {t("adControlSettings")}
              </h3>
            </div>
            <div className="flex justify-center flex-col gap-4">
              {/* Skip mode: off / assist / auto */}
              <motion.div
                whileHover={{
                  y: -2,
                  boxShadow: "0 10px 15px rgba(0,0,0,0.1)",
                  borderRadius: "1rem",
                }}
                transition={{ duration: 0.2 }}
              >
                <div
                  className={`p-4 rounded-lg transition-all duration-300 ${
                    watcherEnabled && skipMode !== "off"
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-accent border border-transparent"
                  } ${!watcherEnabled ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <motion.div
                      whileHover={{
                        y: -2,
                        boxShadow: "0 10px 15px rgba(0,0,0,0.1)",
                        borderRadius: "1rem",
                      }}
                      transition={{ duration: 0.4 }}
                    >
                      <FastForward
                        strokeWidth={2.5}
                        className={`icon-flip h-5 w-5 shrink-0 transition-colors duration-300 ${
                          watcherEnabled && skipMode !== "off"
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                    </motion.div>
                    <h4 className="text-sm font-medium text-foreground text-start">
                      {t("skipModeTitle")}
                    </h4>
                  </div>
                  <SkipModeSwitch
                    value={skipMode}
                    disabled={!watcherEnabled}
                    onChange={handleSkipModeChange}
                    isRTL={isRTL}
                    options={[
                      { value: "off", label: t("skipModeOff") },
                      { value: "assist", label: t("skipModeAssist") },
                      { value: "auto", label: t("skipModeAuto") },
                    ]}
                  />
                  <p className="text-xs text-muted-foreground leading-relaxed mt-3 text-start">
                    {t(skipModeDescKey)}
                  </p>
                  <AnimatePresence>
                    {autoReminderVisible && skipMode === "auto" && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="mt-3 flex items-start gap-2 rounded-md border border-primary/20 bg-background/60 p-2.5 text-start"
                        role="status"
                      >
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {t("skipModeReturnReminder")}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
                {/* Mute Ad Sound Toggle */}
                <div
                  className={`p-4 rounded-lg transition-all duration-300 ${
                    watcherEnabled && muteAdSound
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-accent border border-transparent"
                  } ${!watcherEnabled ? "opacity-50" : ""}`}
                >
                  <div
                    className="flex items-center justify-between"
                  >
                    <div
                      className="flex items-center gap-2 text-start"
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
                          className={`icon-flip w-5 h-5 shrink-0 transition-colors ${
                            watcherEnabled && muteAdSound
                              ? "text-primary"
                              : "text-muted-foreground"
                          }`}
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
                    <div className="shrink-0 ms-3">
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
                    className="flex items-center justify-between"
                  >
                    <div
                      className="flex items-center gap-2 text-start"
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
                    <div className="shrink-0 ms-3">
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

      <PermissionConfirmDialog
        open={permissionDialogOpen}
        title={t("skipModePermissionTitle")}
        body={t("skipModePermissionBody")}
        confirmLabel={t("skipModePermissionConfirm")}
        cancelLabel={t("skipModePermissionCancel")}
        onConfirm={confirmAutoMode}
        onCancel={cancelAutoMode}
      />
    </motion.div>
  );
};

export default AdControlSettingsCard;