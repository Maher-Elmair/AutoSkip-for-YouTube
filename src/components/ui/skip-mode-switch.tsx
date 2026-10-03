import * as React from "react";
import { motion } from "motion/react";
import { CircleMinus, MousePointerClick, Sparkles } from "lucide-react";
import type { SkipMode } from "@/constants/storage";
import { cn } from "@/lib/utils";

export interface SkipModeOption {
  value: SkipMode;
  label: string;
}

interface SkipModeSwitchProps {
  value: SkipMode;
  options: SkipModeOption[];
  onChange: (mode: SkipMode) => void;
  disabled?: boolean;
  isRTL?: boolean;
}

const ICONS: Record<SkipMode, React.ComponentType<{ className?: string }>> = {
  off: CircleMinus,
  assist: Sparkles,
  auto: MousePointerClick,
};

/**
 * Three-position segmented control using a shared active layer so its motion
 * stays correct in both LTR and RTL layouts.
 */
const SkipModeSwitch: React.FC<SkipModeSwitchProps> = ({
  value,
  options,
  onChange,
  disabled = false,
  isRTL = false,
}) => {
  return (
    <div
      role="radiogroup"
      dir={isRTL ? "rtl" : "ltr"}
      className={cn(
        "relative flex w-full gap-1 rounded-lg border border-border/60 bg-accent p-1.5",
        disabled && "opacity-50 pointer-events-none",
      )}
    >
      {options.map((option) => {
        const Icon = ICONS[option.value];
        const isActive = option.value === value;
        const isOff = option.value === "off";

        return (
          <motion.button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            whileTap={{ scale: 0.97 }}
            whileHover={disabled ? undefined : { y: -1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "relative isolate flex min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden rounded-md border border-transparent px-1 py-2.5 text-[11px] font-medium transition-colors duration-200",
              isActive && !isOff ? "text-primary" : "text-muted-foreground",
            )}
          >
            {isActive && (
              <motion.span
                layoutId="skip-mode-active-option"
                className={cn(
                  "absolute inset-0 -z-10 rounded-md border shadow-sm",
                  isOff
                    ? "border-border bg-background/80"
                    : "border-primary/20 bg-primary/15",
                )}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <motion.span
              animate={isActive ? { scale: 1 } : { scale: 0.94 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="inline-flex shrink-0"
            >
              <Icon className="h-3.5 w-3.5" />
            </motion.span>
            <span className="min-w-0 whitespace-nowrap">{option.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
};

export default SkipModeSwitch;
