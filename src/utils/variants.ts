import type { Variants } from 'framer-motion';

// Animation variants with TypeScript types
export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

export const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: "easeOut"
    }
  }
};

export const heroVariants: Variants = {
  enabled: {
    scale: 1.02,
    transition: { duration: 0.3 }
  },
  disabled: {
    scale: 1,
    transition: { duration: 0.3 }
  }
};

export const iconVariants: Variants = {
  enabled: {
    scale: 1.1,
    rotate: 360,
    transition: { 
      type: "spring", 
      duration: 0.3
    }
  },
  disabled: {
    scale: 1,
    rotate: 0,
    transition: { duration: 0.3, ease: "easeInOut" }
  }
};