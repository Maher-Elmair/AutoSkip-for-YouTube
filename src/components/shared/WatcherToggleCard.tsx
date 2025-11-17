import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { SkipForward } from "lucide-react";
import PremiumSwitch from "@/components/ui/premium-switch";
import {
  containerVariants,
  itemVariants,
  heroVariants,
  iconVariants,
} from "@/utils/variants";

interface WatcherToggleCardProps {
  watcherEnabled: boolean;
  setWatcherEnabled: (enabled: boolean) => void;
  currentLanguage: string;
  isRTL: boolean;
  t: (key: string) => string;
}

const WatcherToggleCard: React.FC<WatcherToggleCardProps> = ({
  watcherEnabled,
  setWatcherEnabled,
  currentLanguage,
  isRTL,
  t,
}) => {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-2xl mx-auto container px-4"
    >
      {/* Main Toggle - Hero Section */}
      <motion.div variants={itemVariants}>
        <Card
          className={`p-6 md:p-10 shadow-2xl transition-all duration-300 border-2 overflow-hidden relative ${
            watcherEnabled
              ? "bg-linear-to-br from-primary/10 via-background to-primary/5 border-primary/30"
              : "bg-linear-to-br from-card to-background border-border"
          }`}
        >
          {/* Animated background gradient */}
          {watcherEnabled && (
            <motion.div
              className="absolute inset-0 opacity-20 pointer-events-none"
              initial={{
                background:
                  "radial-gradient(circle at 0% 0%, var(--primary) 0%, transparent 50%)",
              }}
              animate={{
                background: [
                  "radial-gradient(circle at 0% 0%, var(--primary) 0%, transparent 50%)",
                  "radial-gradient(circle at 100% 100%, var(--primary) 0%, transparent 50%)",
                  "radial-gradient(circle at 0% 100%, var(--primary) 0%, transparent 50%)",
                  "radial-gradient(circle at 100% 0%, var(--primary) 0%, transparent 50%)",
                  "radial-gradient(circle at 0% 0%, var(--primary) 0%, transparent 50%)",
                ],
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            />
          )}

          <motion.div
            className="flex flex-col items-center text-center gap-4 relative z-10"
            variants={heroVariants}
            animate={watcherEnabled ? "enabled" : "disabled"}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            {/* Icon Container */}
            <motion.div
              className={`p-6 md:p-8 rounded-full transition-all duration-300 ${
                watcherEnabled
                  ? "bg-primary/20 shadow-xl shadow-primary/20"
                  : "bg-muted/20"
              }`}
              variants={iconVariants}
              animate={watcherEnabled ? "enabled" : "disabled"}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <SkipForward
                className={`w-16 h-16 md:w-18 md:h-18 ${
                  watcherEnabled ? "text-primary" : "text-muted-foreground"
                } transition-colors duration-300`}
              />
            </motion.div>

            {/* Text Content */}
            <div className="w-full space-y-4">
              <motion.h2
                className="text-xl md:text-2xl font-bold text-foreground"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                key={currentLanguage}
              >
                {t("enableWatcher")}
              </motion.h2>

              <motion.p
                className="text-sm md:text-base max-w-[350px] mx-auto leading-relaxed text-muted-foreground"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                key={`${currentLanguage}-desc`}
              >
                {t("enableWatcherDesc")}
              </motion.p>
            </div>

            {/* Toggle Switch Section */}
            <motion.div
              className="flex flex-col items-center gap-6"
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.2 }}
            >
              {/* Status Label */}
              <div className="text-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${watcherEnabled}-${currentLanguage}`}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.3 }}
                    className="text-4xl md:text-5xl font-black"
                    style={{
                      background: watcherEnabled
                        ? "var(--primary)"
                        : "var(--muted-foreground)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      textShadow: watcherEnabled
                        ? "0 4px 20px var(--primary-shadow)"
                        : "none",
                    }}
                  >
                    {t(watcherEnabled ? "enabled" : "disabled")}
                  </motion.div>
                </AnimatePresence>
              </div>
              {/* Premium Switch */}
              <motion.div whileTap={{ scale: 0.95 }} className="relative z-10">
                <PremiumSwitch
                  checked={watcherEnabled}
                  onCheckedChange={setWatcherEnabled}
                />

                {/* Glow Effect */}
                {watcherEnabled && (
                  <motion.div
                    className="absolute -inset-4 rounded-full opacity-40 blur-2xl pointer-events-none"
                    animate={{
                      background: [
                        "radial-gradient(circle, var(--primary), transparent)",
                        "radial-gradient(circle, var(--primary-hover), transparent)",
                        "radial-gradient(circle, var(--primary), transparent)",
                      ],
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                  />
                )}
              </motion.div>

              {/* Small Status Indicator */}
              <motion.div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs ${
                  isRTL ? "flex-row-reverse" : ""
                } hidden`}
                animate={{
                  backgroundColor: watcherEnabled
                    ? "var(--primary)"
                    : "var(--muted)",
                  borderColor: watcherEnabled
                    ? "var(--primary)"
                    : "var(--border)",
                }}
              >
                <motion.div
                  className="w-1.5 h-1.5 rounded-full"
                  animate={{
                    backgroundColor: watcherEnabled
                      ? "var(--background)"
                      : "var(--background)",
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    scale: {
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    },
                  }}
                />
                <span className="font-medium text-background">
                  {watcherEnabled ? t("active") : t("inactive")}
                </span>
              </motion.div>
            </motion.div>
          </motion.div>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default WatcherToggleCard;
