import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Languages } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { containerVariants, itemVariants } from "@/utils/variants";

interface LanguageSelectorProps {
  isRTL: boolean;
  currentLanguage: string;
  t: (key: string) => string;
  onChangeLanguage: (lng: string) => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  isRTL,
  currentLanguage,
  t,
  onChangeLanguage,
}) => {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-2xl w-full mx-auto px-6 space-y-6 "
    >
      <motion.div variants={itemVariants}>
        <motion.div
          whileHover={{ y: -2, boxShadow: "0 10px 15px rgba(0,0,0,0.1)" }}
          transition={{ duration: 0.2 }}
        >
          <Card className="p-6 shadow-md transition-all duration-300 bg-card border-border">
            <div
              className={`flex items-center gap-2.5 mb-3 ${
                isRTL ? "flex-row-reverse" : ""
              }`}
            >
              <motion.div
                whileHover={{ rotate: 180 }}
                transition={{ duration: 0.4 }}
              >
                <Languages className="w-5 h-5 text-primary" />
              </motion.div>
              <label className="text-base text-foreground">
                {t("language")}
              </label>
            </div>
            <Select value={currentLanguage} onValueChange={onChangeLanguage}>
              <SelectTrigger className="w-full h-11 bg-input text-foreground border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-foreground">
                <SelectItem
                  value="en"
                  className="focus:bg-accent focus:text-accent-foreground"
                >
                  {t("english")}
                </SelectItem>
                <SelectItem
                  value="ar"
                  className="focus:bg-accent focus:text-accent-foreground"
                >
                  {t("arabic")}
                </SelectItem>
              </SelectContent>
            </Select>
          </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};
export default LanguageSelector;
