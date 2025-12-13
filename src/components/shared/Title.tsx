import { motion } from "framer-motion";
import { Play } from "lucide-react";

interface TitleProps {
  isRTL: boolean;
  t: (key: string) => string;
}

export function Title({ isRTL, t }: TitleProps) {
  return (
    <div
      className={`flex items-center justify-between ${
        isRTL ? "flex-row-reverse" : ""
      }`}
    >
      <motion.div
        className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center"
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.95 }}
      >
        <Play
          className={`w-5 h-5 text-white fill-white ml-0.5 ${
            isRTL ? "rotate-180" : ""
          }`}
        />
      </motion.div>
      <p className={`text-2xl ${isRTL ? "mr-2" : "ml-2"}`}>{t("title")}</p>
    </div>
  );
}
