import { motion } from "motion/react";
import { Play } from "lucide-react";

interface TitleProps {
  t: (key: string) => string;
}

export function Title({ t }: TitleProps) {
  return (
    <div className="flex items-center justify-between">
      <motion.div
        className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center"
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.95 }}
      >
        <Play className="icon-flip w-5 h-5 text-white fill-white ms-0.5" />
      </motion.div>
      <p className="text-2xl ms-2">{t("title")}</p>
    </div>
  );
}
