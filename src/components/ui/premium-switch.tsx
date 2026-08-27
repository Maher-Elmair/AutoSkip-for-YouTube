import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { SkipForward, CircleStop } from "lucide-react";

interface PremiumSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  isRTL?: boolean;
}

const PremiumSwitch: React.FC<PremiumSwitchProps> = ({
  checked,
  onCheckedChange,
  disabled = false,
  isRTL = false,
}) => {
  const handleClick = () => {
    if (disabled) {
      return;
    }

    onCheckedChange(!checked);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onCheckedChange(!checked);
    }
  };

  // Mirror the thumb position in RTL: ON sits on the left, OFF on the right.
  const onX = isRTL ? 8 : 68;
  const offX = isRTL ? 68 : 8;
  const highlightHiddenX = isRTL ? "100%" : "-100%";

  return (
    <div
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      className={`relative w-32 h-16 rounded-full transition-all duration-500 shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      }`}
      style={{
        background: checked
          ? "linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)"
          : "linear-gradient(135deg, var(--muted) 0%, var(--border) 100%)",
        boxShadow: checked
          ? "var(--switch-shadow-active)"
          : "var(--switch-shadow-inactive)",
      }}
    >
      {/* Track Indicator */}
      <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
        <motion.div
          className="absolute inset-0"
          animate={{
            x: checked ? 0 : highlightHiddenX,
          }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          style={{
            background: isRTL
              ? "linear-gradient(270deg, var(--track-highlight) 0%, transparent 100%)"
              : "linear-gradient(90deg, var(--track-highlight) 0%, transparent 100%)",
          }}
        />
      </div>

      {/* Toggle Circle */}
      <motion.div
        className="absolute top-2 left-0 w-12 z-10 h-12 bg-background rounded-full shadow-2xl flex items-center justify-center pointer-events-none"
        animate={{
          x: checked ? onX : offX,
          rotate: checked ? 360 : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 25,
          rotate: { duration: 0.5 },
        }}
        style={{
          boxShadow: "var(--toggle-shadow)",
        }}
      >
        <AnimatePresence mode="wait">
          {checked ? (
            <motion.div
              key="skip-forward"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ duration: 0.3 }}
            >
              <SkipForward
                size={20}
                strokeWidth={2.5}
                color="var(--primary)"
                style={isRTL ? { transform: "rotate(180deg)" } : undefined}
              />
            </motion.div>
          ) : (
            <motion.div
              key="circle-stop"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ duration: 0.3 }}
            >
              <CircleStop
                size={20}
                strokeWidth={2.5}
                color="var(--muted-foreground)"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Animated Dots */}
      <div className="absolute inset-0 flex items-center justify-around px-6 pointer-events-none">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: "var(--dot-color)",
            }}
            animate={{
              opacity: checked ? [0.3, 0.7, 0.3] : 0.1,
              scale: checked ? [1, 1.2, 1] : 0.8,
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default PremiumSwitch;