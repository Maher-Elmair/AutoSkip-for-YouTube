import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SkipForward, CircleStop } from "lucide-react";

interface PremiumSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

const PremiumSwitch: React.FC<PremiumSwitchProps> = ({ 
  checked, 
  onCheckedChange 
}) => {
  const handleClick = () => {
    onCheckedChange(!checked);
  };

  return (
    <div
      onClick={handleClick}
      className="relative w-32 h-16 rounded-full transition-all duration-500 shadow-2xl cursor-pointer"
      style={{
        background: checked 
          ? 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)'
          : 'linear-gradient(135deg, var(--muted) 0%, var(--border) 100%)',
        boxShadow: checked
          ? 'var(--switch-shadow-active)'
          : 'var(--switch-shadow-inactive)',
      }}
    >
      {/* Track Indicator */}
      <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
        <motion.div
          className="absolute inset-0"
          animate={{
            x: checked ? 0 : '-100%',
          }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          style={{
            background: 'linear-gradient(90deg, var(--track-highlight) 0%, transparent 100%)',
          }}
        />
      </div>

      {/* Toggle Circle */}
      <motion.div
        className="absolute top-2 w-12 h-12 bg-background rounded-full shadow-2xl flex items-center justify-center pointer-events-none"
        animate={{
          x: checked ? 68 : 8,
          rotate: checked ? 360 : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 25,
          rotate: { duration: 0.5 }
        }}
        style={{
          boxShadow: 'var(--toggle-shadow)',
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
              backgroundColor: 'var(--dot-color)'
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